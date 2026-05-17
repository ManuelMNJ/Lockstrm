package com.lockstrm.platform;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@Slf4j
@SpringBootApplication
public class LockstrmApplication {

    public static void main(String[] args) {
        SpringApplication.run(LockstrmApplication.class, args);
        log.info("Lockstrm Platform API is running...");
    }
}
