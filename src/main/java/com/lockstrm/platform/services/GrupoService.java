package com.lockstrm.platform.services;

import com.lockstrm.platform.entities.Grupo;
import com.lockstrm.platform.repositories.GrupoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class GrupoService {

    private final GrupoRepository grupoRepository;

    public List<Grupo> obtenerPorCreador(String emailCreador) {
        return grupoRepository.findByCreador_Email(emailCreador);
    }
}
