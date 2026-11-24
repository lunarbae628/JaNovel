package com.janovel.domain.application.client;

import java.io.DataInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;

final class PublicPostingProxy implements AutoCloseable {

    private final ServerSocket server = new ServerSocket();
    private final Semaphore connections = new Semaphore(32);
    private final PublicPostingDnsResolver dns = new PublicPostingDnsResolver();
    private final ExecutorService worker = Executors.newVirtualThreadPerTaskExecutor();

    PublicPostingProxy() throws IOException {
        server.bind(new InetSocketAddress("127.0.0.1", 0));
        worker.execute(this::accept);
    }

    String address() {
        return "socks5://127.0.0.1:" + server.getLocalPort();
    }

    private void accept() {
        while (!server.isClosed()) {
            try {
                Socket socket = server.accept();
                if (connections.tryAcquire()) {
                    worker.execute(() -> relay(socket));
                } else {
                    socket.close();
                }
            } catch (IOException ignored) {
                return;
            }
        }
    }

    private void relay(Socket browser) {
        try (browser; var upstream = new Socket()) {
            browser.setSoTimeout(8_000);
            var in = new DataInputStream(browser.getInputStream());
            var out = browser.getOutputStream();
            if (in.readUnsignedByte() != 5) {
                return;
            }
            byte[] methods = in.readNBytes(in.readUnsignedByte());
            boolean noAuth = false;
            for (byte method : methods) {
                noAuth |= method == 0;
            }
            out.write(new byte[]{5, (byte) (noAuth ? 0 : 255)});
            if (!noAuth || in.readUnsignedByte() != 5 || in.readUnsignedByte() != 1
                    || in.readUnsignedByte() != 0 || in.readUnsignedByte() != 3) {
                return;
            }
            String host = new String(in.readNBytes(in.readUnsignedByte()), StandardCharsets.US_ASCII);
            int port = in.readUnsignedShort();
            if ((port != 80 && port != 443) || !host.matches("[A-Za-z0-9.-]+")) {
                reject(out);
                return;
            }
            try {
                PostingPageClient.validate(URI.create((port == 443 ? "https://" : "http://") + host));
                InetAddress address = dns.resolve(host)[0];
                upstream.connect(new InetSocketAddress(address, port), 2_000);
            } catch (IllegalArgumentException | IOException exception) {
                reject(out);
                return;
            }
            upstream.setSoTimeout(8_000);
            out.write(new byte[]{5, 0, 0, 1, 0, 0, 0, 0, 0, 0});
            var send = Thread.startVirtualThread(() -> copy(browser, upstream));
            try {
                copy(upstream, browser);
            } finally {
                send.interrupt();
            }
        } catch (IOException ignored) {
            // Chromium closed the tunnel or did not finish the SOCKS handshake.
        } finally {
            connections.release();
        }
    }

    private void reject(OutputStream out) throws IOException {
        out.write(new byte[]{5, 2, 0, 1, 0, 0, 0, 0, 0, 0});
    }

    private void copy(Socket from, Socket to) {
        try {
            from.getInputStream().transferTo(to.getOutputStream());
            to.shutdownOutput();
        } catch (IOException ignored) {
            // The other side closed or reached its idle timeout.
        }
    }

    @Override
    public void close() throws IOException {
        try {
            server.close();
        } finally {
            worker.shutdownNow();
        }
    }
}
