package com.janovel;

import org.springframework.boot.SpringApplication;

public class TestJanovelApplication {

    public static void main(String[] args) {
        SpringApplication.from(JanovelApplication::main)
                .with(TestcontainersConfiguration.class)
                .run(args);
    }
}
