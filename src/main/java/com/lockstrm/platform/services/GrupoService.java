package com.lockstrm.platform.services;

import com.lockstrm.platform.dto.GrupoDTO;
import com.lockstrm.platform.dto.GrupoStatsDTO;
import com.lockstrm.platform.dto.MiembroDTO;
import com.lockstrm.platform.dto.VideoDTO;
import com.lockstrm.platform.entities.Grupo;
import com.lockstrm.platform.entities.MiembrosGrupo;
import com.lockstrm.platform.entities.MiembrosGrupoId;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.entities.Video;
import com.lockstrm.platform.repositories.GrupoRepository;
import com.lockstrm.platform.repositories.MiembrosGrupoRepository;
import com.lockstrm.platform.repositories.PermisosGrupoRepository;
import com.lockstrm.platform.repositories.UserRepository;
import com.lockstrm.platform.repositories.VideoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;

@Service
@RequiredArgsConstructor
public class GrupoService {

    private final GrupoRepository         grupoRepository;
    private final UserRepository          userRepository;
    private final MiembrosGrupoRepository miembrosGrupoRepository;
    private final PermisosGrupoRepository permisosGrupoRepository;
    private final VideoRepository         videoRepository;

    /**
     * Devuelve todos los grupos a los que pertenece el usuario
     * (creador o miembro), mapeados a GrupoDTO con el campo esCreador.
     */
    @Transactional(readOnly = true)
    public List<GrupoDTO> obtenerGruposDelUsuario(String email) {
        return grupoRepository.findGruposForUser(email).stream()
                .map(g -> new GrupoDTO(
                        g.getIdGrupo(),
                        g.getNombre(),
                        g.getIdCreador(),
                        g.getFechaCreacion(),
                        g.getCreador().getEmail().equals(email)))
                .toList();
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
     * Devuelve el detalle de un único grupo como DTO con el campo esCreador.
     * Lanza {@link AccessDeniedException} (→ 403) si el solicitante no es creador ni miembro.
     * Lanza {@link NoSuchElementException} (→ 404) si el grupo no existe.
     */
    @Transactional(readOnly = true)
    public GrupoDTO obtenerDetalle(Long idGrupo, String email) {
        Grupo grupo = grupoRepository.findById(idGrupo)
                .orElseThrow(() -> new NoSuchElementException("Grupo no encontrado: " + idGrupo));

        boolean esCreador = grupo.getCreador().getEmail().equals(email);
        boolean esMiembro = miembrosGrupoRepository.existsByUsuario_EmailAndId_IdGrupoId(email, idGrupo);

        if (!esCreador && !esMiembro) {
            throw new AccessDeniedException("No tienes acceso a este grupo");
        }

        return new GrupoDTO(
                grupo.getIdGrupo(),
                grupo.getNombre(),
                grupo.getIdCreador(),
                grupo.getFechaCreacion(),
                esCreador);
    }

    @Transactional(readOnly = true)
    public List<MiembroDTO> obtenerMiembros(Long idGrupo, String emailSolicitante) {
        Grupo grupo = grupoRepository.findById(idGrupo)
                .orElseThrow(() -> new NoSuchElementException("Grupo no encontrado: " + idGrupo));

        boolean esCreador = grupo.getCreador() != null &&
                grupo.getCreador().getEmail().equals(emailSolicitante);
        boolean esMiembro = miembrosGrupoRepository.existsByUsuario_EmailAndId_IdGrupoId(emailSolicitante, idGrupo);

        if (!esCreador && !esMiembro) {
            throw new AccessDeniedException("No tienes acceso a este grupo");
        }

        List<MiembroDTO> miembros = miembrosGrupoRepository.findMiembrosByGrupoId(idGrupo);
        return miembros != null ? miembros : List.of();
    }

    @Transactional(readOnly = true)
    public List<GrupoStatsDTO> obtenerGrupoStats(String email) {
        return grupoRepository.findGrupoStatsForUser(email);
    }

    @Transactional(readOnly = true)
    public List<VideoDTO> obtenerVideosDeGrupo(Long idGrupo, String emailSolicitante) {
        Grupo grupo = grupoRepository.findById(idGrupo)
                .orElseThrow(() -> new NoSuchElementException("Grupo no encontrado: " + idGrupo));

        boolean esCreador = grupo.getCreador() != null &&
                grupo.getCreador().getEmail().equals(emailSolicitante);
        boolean esMiembro = miembrosGrupoRepository.existsByUsuario_EmailAndId_IdGrupoId(emailSolicitante, idGrupo);

        if (!esCreador && !esMiembro) {
            throw new AccessDeniedException("No tienes acceso a este grupo");
        }

        return videoRepository.findByGrupoId(idGrupo).stream()
                .map(v -> new VideoDTO(
                        v.getIdVideo(),
                        v.getTitulo(),
                        v.getDuracion(),
                        v.getFechaSubida(),
                        idGrupo,
                        grupo.getNombre()))
                .toList();
    }

    // ── Security helper ───────────────────────────────────────────────────────

    /**
     * Fetches the group and throws {@link AccessDeniedException} (→ 403) if
     * {@code email} is not the creator. Returns the group for further use.
     */
    private Grupo requireCreador(Long idGrupo, String email) {
        Grupo grupo = grupoRepository.findById(idGrupo)
                .orElseThrow(() -> new NoSuchElementException("Grupo no encontrado: " + idGrupo));
        if (!grupo.getCreador().getEmail().equals(email)) {
            throw new AccessDeniedException("Solo el creador del grupo puede realizar esta acción");
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
    public MiembroDTO aniadirMiembro(Long idGrupo, String emailSolicitante, String emailInvitado) {
        Grupo grupo = requireCreador(idGrupo, emailSolicitante);

        Usuario invitado = userRepository.findByEmail(emailInvitado)
                .orElseThrow(() -> new NoSuchElementException("Usuario no encontrado: " + emailInvitado));

        if (emailInvitado.equals(grupo.getCreador().getEmail())) {
            throw new IllegalArgumentException("El creador del grupo ya forma parte de él");
        }

        MiembrosGrupoId miembroId = new MiembrosGrupoId(invitado.getIdUsuario(), idGrupo);
        if (miembrosGrupoRepository.existsById(miembroId)) {
            throw new IllegalArgumentException("El usuario ya es miembro de este grupo");
        }

        MiembrosGrupo miembro = new MiembrosGrupo();
        miembro.setId(miembroId);
        miembrosGrupoRepository.save(miembro);

        return new MiembroDTO(invitado.getIdUsuario(), invitado.getNombre(), invitado.getEmail());
    }

    /**
     * Elimina un miembro del grupo. Solo el creador puede expulsar miembros.
     * Lanza {@link AccessDeniedException} (→ 403) si el solicitante no es el creador.
     */
    @Transactional
    public void eliminarMiembro(Long idGrupo, Long idUsuario, String emailSolicitante) {
        requireCreador(idGrupo, emailSolicitante);
        miembrosGrupoRepository.deleteByGrupoIdAndUsuarioId(idGrupo, idUsuario);
    }

    /**
     * Renombra un grupo. Solo el creador puede cambiar el nombre.
     * Lanza {@link AccessDeniedException} (→ 403) si el solicitante no es el creador.
     */
    @Transactional
    public Grupo renombrarGrupo(Long idGrupo, String nuevoNombre, String emailSolicitante) {
        Grupo grupo = requireCreador(idGrupo, emailSolicitante);
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
        requireCreador(idGrupo, emailSolicitante);
        // Desvincular vídeos del grupo (quedan privados, no se eliminan)
        videoRepository.desasociarVideosDeGrupo(idGrupo);
        // Eliminar relaciones antes que el grupo (FK constraints)
        miembrosGrupoRepository.deleteByGrupoId(idGrupo);
        grupoRepository.deleteGrupoById(idGrupo);
    }
}
