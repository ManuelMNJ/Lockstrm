package com.lockstrm.platform.services;

import com.lockstrm.platform.entities.Grupo;
import com.lockstrm.platform.entities.MiembrosGrupo;
import com.lockstrm.platform.entities.MiembrosGrupoId;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.repositories.GrupoRepository;
import com.lockstrm.platform.repositories.MiembrosGrupoRepository;
import com.lockstrm.platform.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class GrupoService {

    private final GrupoRepository        grupoRepository;
    private final UserRepository         userRepository;
    private final MiembrosGrupoRepository miembrosGrupoRepository;

    /**
     * Devuelve todos los grupos a los que pertenece el usuario:
     * los que creó + los que integra como miembro (sin duplicados).
     */
    @Transactional(readOnly = true)
    public List<Grupo> obtenerGruposDelUsuario(String email) {
        List<Grupo> comoCreador = grupoRepository.findByCreador_Email(email);
        List<Grupo> comoMiembro = miembrosGrupoRepository.findGruposByUsuarioEmail(email);

        Set<Long> vistos = new HashSet<>();
        List<Grupo> resultado = new ArrayList<>();

        for (Grupo g : comoCreador) {
            if (vistos.add(g.getIdGrupo())) resultado.add(g);
        }
        for (Grupo g : comoMiembro) {
            if (vistos.add(g.getIdGrupo())) resultado.add(g);
        }
        return resultado;
    }

    public Grupo crearGrupo(String emailCreador, String nombre) {
        Usuario creador = userRepository.findByEmail(emailCreador)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        Grupo grupo = new Grupo();
        grupo.setNombre(nombre);
        grupo.setCreador(creador);
        return grupoRepository.save(grupo);
    }

    @Transactional
    public void aniadirMiembro(Long idGrupo, String emailSolicitante, String emailInvitado) {
        Grupo grupo = grupoRepository.findById(idGrupo)
                .orElseThrow(() -> new NoSuchElementException("Grupo no encontrado: " + idGrupo));

        if (!grupo.getCreador().getEmail().equals(emailSolicitante)) {
            throw new AccessDeniedException("Solo el creador del grupo puede añadir miembros");
        }

        Usuario invitado = userRepository.findByEmail(emailInvitado)
                .orElseThrow(() -> new NoSuchElementException("Usuario no encontrado: " + emailInvitado));

        MiembrosGrupoId miembroId = new MiembrosGrupoId(invitado.getIdUsuario(), idGrupo);
        MiembrosGrupo miembro = new MiembrosGrupo();
        miembro.setId(miembroId);
        miembrosGrupoRepository.save(miembro);
    }
}
