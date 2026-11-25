package com.janovel.domain.application.client;

import com.janovel.domain.application.exception.PostingErrorCode;
import com.janovel.global.exception.CustomException;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import javax.imageio.ImageIO;
import javax.imageio.ImageReadParam;

public final class PostingImageTiles {

    private static final int TILE_WIDTH = 1_100;
    private static final int TILE_HEIGHT = 1_500;
    private static final int OVERLAP = 80;
    public static final int MAX_TILES = 16;
    private static final int MIN_WIDTH = 400;
    private static final int MIN_HEIGHT = 500;

    private PostingImageTiles() {
    }

    public static List<byte[]> split(byte[] image) {
        try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(image))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                return List.of();
            }
            var reader = readers.next();
            try {
                reader.setInput(input, true, true);
                int width = reader.getWidth(0);
                if (width < MIN_WIDTH || reader.getHeight(0) < MIN_HEIGHT) {
                    return List.of();
                }
                int scale = Math.max(1, (int) Math.ceil(width / (double) TILE_WIDTH));
                if (reader.getHeight(0) / scale > MAX_TILES * TILE_HEIGHT) {
                    throw new CustomException(PostingErrorCode.POSTING_IMAGE_TOO_LARGE);
                }
                var param = new ImageReadParam();
                param.setSourceSubsampling(scale, scale, 0, 0);
                var scaled = reader.read(0, param);
                int step = TILE_HEIGHT - OVERLAP;
                var tiles = new ArrayList<byte[]>();
                for (int top = 0; ; top += step) {
                    if (tiles.size() == MAX_TILES) {
                        throw new CustomException(PostingErrorCode.POSTING_IMAGE_TOO_LARGE);
                    }
                    int tileHeight = Math.min(TILE_HEIGHT, scaled.getHeight() - top);
                    var output = new ByteArrayOutputStream();
                    ImageIO.write(scaled.getSubimage(0, top, scaled.getWidth(), tileHeight), "png", output);
                    tiles.add(output.toByteArray());
                    if (top + tileHeight >= scaled.getHeight()) {
                        return tiles;
                    }
                }
            } finally {
                reader.dispose();
            }
        } catch (IOException exception) {
            throw new CustomException(PostingErrorCode.POSTING_UNREADABLE, exception);
        }
    }
}
