import argparse
import json
import logging
import multiprocessing
import os
import re
import signal
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from queue import Empty, Queue
from tempfile import TemporaryDirectory


MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000
MAX_TEXT_LENGTH = 30_000
BODY_TIMEOUT = 1.0
WORK_TIMEOUT = 10.0
STARTUP_TIMEOUT = 120.0
IMAGE_FORMATS = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}
LOGGER = logging.getLogger("janovel.ocr")


def recognize_image(model, path, content_type):
    import numpy
    from PIL import Image, ImageOps, UnidentifiedImageError

    try:
        with Image.open(path) as image:
            if image.format != IMAGE_FORMATS[content_type]:
                return 415, "OCR_UNSUPPORTED_IMAGE"
            if image.width * image.height > MAX_IMAGE_PIXELS:
                return 413, "OCR_IMAGE_TOO_LARGE"
            ImageOps.exif_transpose(image, in_place=True)
            pixels = numpy.asarray(image.convert("RGB"))[:, :, ::-1].copy()
    except Image.DecompressionBombError:
        return 413, "OCR_IMAGE_TOO_LARGE"
    except (UnidentifiedImageError, OSError, ValueError):
        return 400, "OCR_INVALID_IMAGE"

    lines = [
        line.strip()
        for result in model.predict(pixels)
        for line in result["rec_texts"]
        if line.strip()
    ]
    return 200, "\n".join(lines)[:MAX_TEXT_LENGTH]


def run_model(connection, cpu_threads):
    try:
        os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "1")
        import numpy
        from paddleocr import PaddleOCR

        model = PaddleOCR(
            text_detection_model_name="PP-OCRv5_mobile_det",
            text_recognition_model_name="korean_PP-OCRv5_mobile_rec",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            device="cpu",
            enable_mkldnn=False,
            cpu_threads=cpu_threads,
            text_det_limit_side_len=1280,
            text_det_limit_type="max",
            text_recognition_batch_size=12,
        )
        model.predict(numpy.full((64, 256, 3), 255, dtype=numpy.uint8))
        connection.send(True)
    except Exception as error:
        LOGGER.error("model startup failed type=%s", type(error).__name__)
        connection.close()
        return

    try:
        while True:
            path, content_type = connection.recv()
            try:
                result = recognize_image(model, path, content_type)
            except Exception as error:
                LOGGER.error("model inference failed type=%s", type(error).__name__)
                result = 500, "OCR_ENGINE_FAILED"
            connection.send(result)
    except (EOFError, OSError):
        pass
    finally:
        connection.close()


class Worker:
    def __init__(self, cpu_threads, startup_lock):
        self.cpu_threads = cpu_threads
        self.startup_lock = startup_lock
        self.context = multiprocessing.get_context("spawn")
        self.state = threading.Lock()
        self.slot = threading.Lock()
        self.stopping = threading.Event()
        self.jobs = Queue(maxsize=1)
        self.ready = False
        self.supervisor = threading.Thread(target=self.run, name="ocr-supervisor")

    def is_ready(self):
        with self.state:
            return self.ready

    def try_reserve(self):
        with self.state:
            if not self.ready:
                return "OCR_NOT_READY"
            if not self.slot.acquire(blocking=False):
                return "OCR_BUSY"
            return None

    def extract(self, path, content_type):
        reply = Queue(maxsize=1)
        with self.state:
            if not self.ready:
                return 503, "OCR_NOT_READY"
            self.jobs.put_nowait((path, content_type, reply))
        return reply.get()

    def run(self):
        while not self.stopping.is_set():
            connection, model_connection = self.context.Pipe()
            process = self.context.Process(target=run_model, args=(model_connection, self.cpu_threads))
            try:
                with self.startup_lock:
                    if self.stopping.is_set():
                        return
                    process.start()
                    model_connection.close()
                    initialized = False
                    try:
                        initialized = self.wait(connection, STARTUP_TIMEOUT) and connection.recv() is True
                    finally:
                        if not initialized and process.is_alive():
                            process.kill()
                            process.join()
                if initialized:
                    with self.state:
                        self.ready = True
                    LOGGER.info("model worker ready pid=%d", process.pid)
                    self.accept_jobs(process, connection)
                elif not self.stopping.is_set():
                    LOGGER.error("model startup timed out")
            except (EOFError, OSError) as error:
                LOGGER.error("model process unavailable type=%s", type(error).__name__)
            finally:
                with self.state:
                    self.ready = False
                    try:
                        _, _, reply = self.jobs.get_nowait()
                    except Empty:
                        pass
                    else:
                        reply.put((500, "OCR_ENGINE_FAILED"))
                connection.close()
                model_connection.close()
                if process.pid is not None:
                    if process.is_alive():
                        process.kill()
                    process.join()
                process.close()
            self.stopping.wait(1.0)

    def accept_jobs(self, process, connection):
        while not self.stopping.is_set() and process.is_alive():
            try:
                path, content_type, reply = self.jobs.get(timeout=0.2)
            except Empty:
                continue
            try:
                connection.send((path, content_type))
                if not self.wait(connection, WORK_TIMEOUT):
                    result = 504, "OCR_TIMEOUT"
                else:
                    result = connection.recv()
            except (EOFError, OSError):
                result = 500, "OCR_ENGINE_FAILED"

            if result[0] >= 500:
                with self.state:
                    self.ready = False
                if process.is_alive():
                    process.kill()
                    process.join(timeout=0.25)
                reply.put(result)
                return
            reply.put(result)

    def wait(self, connection, seconds):
        deadline = time.monotonic() + seconds
        while not self.stopping.is_set():
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return False
            if connection.poll(min(remaining, 0.2)):
                return True
        return False


class WorkerPool:
    def __init__(self, size, cpu_threads):
        startup_lock = threading.Lock()
        self.workers = [Worker(cpu_threads, startup_lock) for _ in range(size)]

    def start(self):
        for worker in self.workers:
            worker.supervisor.start()

    def stop(self):
        for worker in self.workers:
            worker.stopping.set()
        for worker in self.workers:
            worker.supervisor.join()

    def is_ready(self):
        return any(worker.is_ready() for worker in self.workers)

    def reserve(self):
        error = "OCR_NOT_READY"
        for worker in self.workers:
            result = worker.try_reserve()
            if result is None:
                return worker, None
            if result == "OCR_BUSY":
                error = result
        return None, error


class OcrHttpServer(ThreadingHTTPServer):
    def __init__(self, address, pool):
        self.pool = pool
        super().__init__(address, OcrRequestHandler)


class OcrRequestHandler(BaseHTTPRequestHandler):
    def setup(self):
        self.request.settimeout(3.0)
        super().setup()

    def do_GET(self):
        if self.path != "/readyz":
            self.respond(404, {"error": "OCR_NOT_FOUND"})
        elif self.server.pool.is_ready():
            self.respond(200, {"ready": True})
        else:
            self.respond(503, {"error": "OCR_NOT_READY"})

    def do_POST(self):
        started = time.monotonic()
        request_id = self.headers.get("X-Request-Id", "")
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", request_id):
            request_id = uuid.uuid4().hex
        status, result = self.extract()
        LOGGER.info("request_id=%s elapsed_ms=%d status=%d error=%s", request_id,
                    (time.monotonic() - started) * 1000, status, result if status != 200 else "-")
        self.respond(status, {"text": result} if status == 200 else {"error": result}, request_id)

    def extract(self):
        if self.path != "/internal/ocr":
            return 404, "OCR_NOT_FOUND"
        content_type = self.headers.get_content_type()
        if content_type not in IMAGE_FORMATS:
            return 415, "OCR_UNSUPPORTED_IMAGE"
        lengths = self.headers.get_all("Content-Length", [])
        if self.headers.get("Transfer-Encoding") or len(lengths) != 1 or not lengths[0].isdigit():
            return 400, "OCR_INVALID_IMAGE"
        try:
            size = int(lengths[0])
        except ValueError:
            return 400, "OCR_INVALID_IMAGE"
        if size > MAX_IMAGE_BYTES:
            return 413, "OCR_IMAGE_TOO_LARGE"
        if size == 0:
            return 400, "OCR_INVALID_IMAGE"

        worker, error = self.server.pool.reserve()
        if worker is None:
            return 503, error
        try:
            with TemporaryDirectory(prefix="janovel-ocr-") as directory:
                path = Path(directory) / "image"
                if not self.receive_image(path, size):
                    return 400, "OCR_INVALID_IMAGE"
                return worker.extract(str(path), content_type)
        except TimeoutError:
            return 504, "OCR_TIMEOUT"
        except OSError:
            return 500, "OCR_ENGINE_FAILED"
        finally:
            worker.slot.release()

    def receive_image(self, path, size):
        deadline = time.monotonic() + BODY_TIMEOUT
        with path.open("wb") as image:
            while size:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError
                self.connection.settimeout(remaining)
                chunk = self.rfile.read1(min(64 * 1024, size))
                if not chunk:
                    return False
                image.write(chunk)
                size -= len(chunk)
        return True

    def respond(self, status, body, request_id=None):
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        try:
            self.connection.settimeout(1.0)
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            if request_id:
                self.send_header("X-Request-Id", request_id)
            self.end_headers()
            self.wfile.write(encoded)
        except (BrokenPipeError, ConnectionResetError, TimeoutError):
            pass

    def log_message(self, *_args):
        pass


def positive_int(value):
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return number


def main():
    parser = argparse.ArgumentParser(description="JaNovel local OCR service")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8091)
    parser.add_argument("--workers", type=positive_int, default=1)
    parser.add_argument("--cpu-threads", type=positive_int, default=4)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    def stop_server(_signal, _frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, stop_server)
    pool = WorkerPool(args.workers, args.cpu_threads)
    server = OcrHttpServer((args.host, args.port), pool)
    with server:
        pool.start()
        try:
            LOGGER.info("listening on %s:%d workers=%d cpu_threads_per_worker=%d",
                        args.host, args.port, args.workers, args.cpu_threads)
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            pool.stop()


if __name__ == "__main__":
    main()
