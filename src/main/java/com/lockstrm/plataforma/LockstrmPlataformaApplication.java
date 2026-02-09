package com.lockstrm.plataforma;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class LockstrmPlataformaApplication {

    public static void main(String[] args) {
        SpringApplication.run(LockstrmPlataformaApplication.class, args);
        
        System.out.println(">>>  LOCKSTRM PLATAFORMA HA ARRANCADO CORRECTAMENTE  <<<");
    }

}
