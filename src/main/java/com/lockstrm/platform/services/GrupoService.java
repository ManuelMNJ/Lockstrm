package com.lockstrm.platform.services;

import com.lockstrm.platform.entities.Grupo;
import com.lockstrm.platform.entities.MiembrosGrupo;
import com.lockstrm.platform.entities.MiembrosGrupoId;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.repositories.GrupoRepository;
import com.lockstrm.platform.repositories.MiembrosGrupoRepository;
import com.lockstrm.platform.repositories.PermisosGrupoRepository;
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

    private final GrupoRepository         grupoRepository;
    private final UserRepository          userRepository;
    private final MiembrosGrupoRepository miembrosGrupoRepository;
    private final PermisosGrupoRepository permisosGrupoRepository;

    /**
     * Devuelve todos los grupos a los que pertenece el usuario:
     * los que creó + los que integra como miembro (sin duplicados).
     * Mantiene compatibilidad con clientes existentes.
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

    /** Grupos Creados por Mí: grupos donde el usuario autenticado es el administrador/creador (contexto Propietario). */
    @Transactional(readOnly = true)
    public List<Grupo> obtenerGruposCreados(String email) {
        return grupoRepository.findByCreador_Email(email);
    }

    /** Grupos a los que pertenezco: grupos donde el usuario es solo miembro, no creador (contexto Miembro). */
    @Transactional(readOnly = true)
    public List<Grupo> obtenerGruposComoMiembro(String email) {
        return miembrosGrupoRepository.findGruposComoMiembroNoCreador(email);
    }

    /**
     * Devuelve el detalle de un único grupo.
     * Lanza {@link AccessDeniedException} (→ 403) si el solicitante no es creador ni miembro.
     * Lanza {@link NoSuchElementException} (→ 404) si el grupo no existe.
     */
    @Transactional(readOnly = true)
    public Grupo obtenerDetalle(Long idGrupo, String email) {
        Grupo grupo = grupoRepository.findById(idGrupo)
                .orElseThrow(() -> new NoSuchElementException("Grupo no encontrado: " + idGrupo));

        boolean esCreador = grupo.getCreador().getEmail().equals(email);
        boolean esMiembro = miembrosGrupoRepository.existsByUsuario_EmailAndId_IdGrupoId(email, idGrupo);

        if (!esCreador && !esMiembro) {
            throw new AccessDeniedException("No tienes acceso a este grupo");
        }

        return grupo;
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

    /**
     * Elimina un miembro del grupo. Solo el creador puede expulsar miembros.
     * Lanza {@link AccessDeniedException} (→ 403) si el solicitante no es el creador.
     */
    @Transactional
    public void eliminarMiembro(Long idGrupo, Long idUsuario, String emailSolicitante) {
        Grupo grupo = grupoRepository.findById(idGrupo)
                .orElseThrow(() -> new NoSuchElementException("Grupo no encontrado: " + idGrupo));

        if (!grupo.getCreador().getEmail().equals(emailSolicitante)) {
            throw new AccessDeniedException("Solo el creador del grupo puede eliminar miembros");
        }

        miembrosGrupoRepository.deleteByGrupoIdAndUsuarioId(idGrupo, idUsuario);
    }

    /**
     * Renombra un grupo. Solo el creador puede cambiar el nombre.
     * Lanza {@link AccessDeniedException} (→ 403) si el solicitante no es el creador.
     */
    @Transactional
    public Grupo renombrarGrupo(Long idGrupo, String nuevoNombre, String emailSolicitante) {
        Grupo grupo = grupoRepository.findById(idGrupo)
                .orElseThrow(() -> new NoSuchElementException("Grupo no encontrado: " + idGrupo));

        if (!grupo.getCreador().getEmail().equals(emailSolicitante)) {
            throw new AccessDeniedException("Solo el creador del grupo puede cambiar su nombre");
        }

        grupo.setNombre(nuevoNombre.trim());
        return grupoRepository.save(grupo);
    }

    /**
     * Elimina un grupo y todas sus relaciones (miembros y permisos de vídeo).
     * Solo el creador puede eliminar el grupo.
     * Los vídeos asignados al grupo NO se eliminan; quedan como privados.
     */
    @Transactional
    public void eliminarGrupo(Long idGrupo, String emailSolicitante) {
        Grupo grupo = grupoRepository.findById(idGrupo)
                .orElseThrow(() -> new NoSuchElementException("Grupo no encontrado: " + idGrupo));

        if (!grupo.getCreador().getEmail().equals(emailSolicitante)) {
            throw new AccessDeniedException("Solo el creador del grupo puede eliminarlo");
        }

        // Eliminar relaciones antes que el grupo (FK constraints)
        miembrosGrupoRepository.deleteByGrupoId(idGrupo);
        permisosGrupoRepository.deleteByGrupoId(idGrupo);
        grupoRepository.delete(grupo);
    }
}
