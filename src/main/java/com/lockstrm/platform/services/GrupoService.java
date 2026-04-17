package com.lockstrm.platform.services;

import com.lockstrm.platform.dto.MiembroDto;
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
import java.util.Set;
import java.util.stream.Collectors;

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
    public List<Grupo> obtenerGruposDelUsuario(String email) {
        List<Grupo> comoCreador = grupoRepository.findByCreador_Email(email);
        List<Grupo> comoMiembro = miembrosGrupoRepository.findGruposByUsuarioEmail(email);

        Set<Long> vistos = new HashSet<>();
        List<Grupo> resultado = new ArrayList<>(comoCreador.size() + comoMiembro.size());

        addUnique(resultado, comoCreador, vistos);
        addUnique(resultado, comoMiembro, vistos);
        return resultado;
    }

    private void addUnique(List<Grupo> resultado, List<Grupo> grupos, Set<Long> vistos) {
        for (Grupo g : grupos) {
            if (vistos.add(g.getIdGrupo())) {
                resultado.add(g);
            }
        }
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

        verifyGrupoAccess(grupo, email);
        return grupo;
    }

    private void verifyGrupoAccess(Grupo grupo, String email) {
        boolean esCreador = grupo.getCreador().getEmail().equals(email);
        boolean esMiembro = miembrosGrupoRepository.countMiembroByEmailAndGrupo(email, grupo.getIdGrupo()) > 0;

        if (!esCreador && !esMiembro) {
            throw new AccessDeniedException("No tienes acceso a este grupo");
        }
    }

    private void verifyCreadorOnly(Grupo grupo, String email, String action) {
        if (!grupo.getCreador().getEmail().equals(email)) {
            throw new AccessDeniedException("Solo el creador del grupo puede " + action);
        }
    }

    /**
     * Lista los miembros de un grupo.
     * Solo accesible si el solicitante es creador o miembro del grupo.
     */
    @Transactional(readOnly = true)
    public List<MiembroDto> obtenerMiembros(Long idGrupo, String email) {
        Grupo grupo = grupoRepository.findById(idGrupo)
                .orElseThrow(() -> new NoSuchElementException("Grupo no encontrado: " + idGrupo));
        verifyGrupoAccess(grupo, email);

        return miembrosGrupoRepository.findUsuariosByGrupoId(idGrupo)
                .stream()
                .map(u -> new MiembroDto(u.getIdUsuario(), resolverNombre(u), u.getEmail()))
                .collect(Collectors.toList());
    }

    private String resolverNombre(Usuario u) {
        String nombre = u.getNombre() != null ? u.getNombre() : "";
        String apellidos = u.getApellidos() != null ? u.getApellidos() : "";
        String full = (nombre + " " + apellidos).trim();
        return full.isEmpty() ? u.getEmail() : full;
    }

    @Transactional
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
        verifyCreadorOnly(grupo, emailSolicitante, "añadir miembros");

        Usuario invitado = userRepository.findByEmail(emailInvitado)
                .orElseThrow(() -> new NoSuchElementException("Usuario no encontrado: " + emailInvitado));

        if (emailInvitado.equals(grupo.getCreador().getEmail())) {
            throw new IllegalArgumentException("El creador del grupo ya forma parte de él");
        }

        MiembrosGrupoId miembroId = new MiembrosGrupoId(invitado.getIdUsuario(), idGrupo);
        if (miembrosGrupoRepository.existsById(miembroId)) {
            throw new IllegalArgumentException("El usuario ya es miembro del grupo");
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
        Grupo grupo = grupoRepository.findById(idGrupo)
                .orElseThrow(() -> new NoSuchElementException("Grupo no encontrado: " + idGrupo));
        verifyCreadorOnly(grupo, emailSolicitante, "eliminar miembros");

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
        verifyCreadorOnly(grupo, emailSolicitante, "cambiar su nombre");

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
        verifyCreadorOnly(grupo, emailSolicitante, "eliminarlo");

        miembrosGrupoRepository.deleteByGrupoId(idGrupo);
        grupoRepository.deleteGrupoById(idGrupo);
    }
}
