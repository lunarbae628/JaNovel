package com.janovel.domain.application.client;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;
import org.apache.hc.client5.http.DnsResolver;

final class PublicPostingDnsResolver implements DnsResolver {

    @Override
    public InetAddress[] resolve(String host) throws UnknownHostException {
        InetAddress[] addresses = InetAddress.getAllByName(host);
        if (addresses.length == 0 || !Arrays.stream(addresses).allMatch(this::isPublicAddress)) {
            throw new IllegalArgumentException("공개 IP로 연결되는 도메인 주소가 필요합니다.");
        }
        return addresses;
    }

    @Override
    public String resolveCanonicalHostname(String host) {
        return host;
    }

    private boolean isPublicAddress(InetAddress address) {
        byte[] bytes = address.getAddress();
        int a = Byte.toUnsignedInt(bytes[0]);
        int b = Byte.toUnsignedInt(bytes[1]);
        int c = Byte.toUnsignedInt(bytes[2]);
        int d = Byte.toUnsignedInt(bytes[3]);
        if (bytes.length == 16) {
            return a >= 0x20 && a <= 0x3f && !(a == 0x20 && b == 0x02)
                    && !(a == 0x20 && b == 0x01 && (c < 2 || (c == 0x0d && d == 0xb8)))
                    && !(a == 0x3f && b == 0xff && c < 0x10);
        }
        return switch (a) {
            case 0, 10, 127 -> false;
            case 100 -> b < 64 || b > 127;
            case 169 -> b != 254;
            case 172 -> b < 16 || b > 31;
            case 192 -> b != 168 && !(b == 0 && (c == 0 || c == 2)) && !(b == 88 && c == 99);
            case 198 -> b != 18 && b != 19 && !(b == 51 && c == 100);
            case 203 -> b != 0 || c != 113;
            default -> a < 224;
        };
    }
}
