package com.lockstrm.platform;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class LockstrmApplication {

    public static void main(String[] args) {
        SpringApplication.run(LockstrmApplication.class, args);
        System.out.println("Lockstrm Platform API is running...");
    }
}
