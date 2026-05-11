package com.lockstrm.platform.services;

import com.lockstrm.platform.dto.MemberDto;
import com.lockstrm.platform.entities.Group;
import com.lockstrm.platform.entities.GroupMember;
import com.lockstrm.platform.entities.GroupMemberId;
import com.lockstrm.platform.entities.User;
import com.lockstrm.platform.enums.GroupRole;
import com.lockstrm.platform.repositories.GroupRepository;
import com.lockstrm.platform.repositories.LogRepository;
import com.lockstrm.platform.repositories.GroupMemberRepository;
import com.lockstrm.platform.repositories.GroupPermissionRepository;
import com.lockstrm.platform.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.data.domain.PageRequest;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GroupService {

    private final GroupRepository           grupoRepository;
    private final UserRepository            userRepository;
    private final GroupMemberRepository     miembrosGroupRepository;
    private final GroupPermissionRepository permisosGroupRepository;
    private final LogRepository             logRepository;
    private final UserService               userService;

    @Value("${lockstrm.upload.grupos.dir}")
    private String gruposImgDir;

    @Transactional(readOnly = true)
    public List<Group> obtenerGruposDelUsuario(String email) {
        List<Group> comoCreador = grupoRepository.findByCreador_Email(email);
        List<Group> comoMiembro = miembrosGroupRepository.findGruposByUsuarioEmail(email);

        Set<Long> vistos = new HashSet<>();
        List<Group> resultado = new ArrayList<>(comoCreador.size() + comoMiembro.size());

        addUnique(resultado, comoCreador, vistos);
        addUnique(resultado, comoMiembro, vistos);
        return resultado;
    }

    private void addUnique(List<Group> resultado, List<Group> grupos, Set<Long> vistos) {
        for (Group g : grupos) {
            if (vistos.add(g.getIdGrupo())) {
                resultado.add(g);
            }
        }
    }

    /**
     * Devuelve los últimos {@code limit} grupos en los que el usuario ha
     * reproducido algún vídeo, ordenados de más reciente a más antiguo.
     * La fuente es la tabla Log (grupoId + fechaHora), por lo que refleja
     * actividad real sin necesidad de un campo extra en la entidad Group.
     * Grupos eliminados no aparecen porque nullifyGrupoId() pone su id a NULL.
     */
    @Transactional(readOnly = true)
    public List<Group> obtenerGruposRecientes(String email, int limit) {
        List<Long> ids = logRepository.findGruposRecientesByEmail(
                email, PageRequest.of(0, limit));
        if (ids.isEmpty()) return List.of();

        Map<Long, Group> porId = grupoRepository.findAllById(ids)
                .stream()
                .collect(Collectors.toMap(Group::getIdGrupo, g -> g));

        // Preservar el orden devuelto por la query (más reciente primero)
        return ids.stream()
                .map(porId::get)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Group> obtenerGruposCreados(String email) {
        return grupoRepository.findByCreador_Email(email);
    }

    @Transactional(readOnly = true)
    public List<Group> obtenerGruposComoMiembro(String email) {
        return miembrosGroupRepository.findGruposComoMiembroNoCreador(email);
    }

    @Transactional(readOnly = true)
    public Group obtenerDetalle(Long idGrupo, String email) {
        Group grupo = grupoRepository.getByIdOrThrow(idGrupo);
        verifyGrupoAccess(grupo, email);
        return grupo;
    }

    private void verifyGrupoAccess(Group grupo, String email) {
        User creador = grupo.getCreador();
        boolean esCreador = creador != null && creador.getEmail().equals(email);
        boolean esMiembro = miembrosGroupRepository.countMiembroByEmailAndGrupo(email, grupo.getIdGrupo()) > 0;

        if (!esCreador && !esMiembro) {
            throw new AccessDeniedException("No tienes acceso a este grupo");
        }
    }

    private GroupMember getMiembroActivoOrThrow(Long idGrupo, String email) {
        User usuario = userRepository.getByEmailOrThrow(email);
        return miembrosGroupRepository
                .findById(new GroupMemberId(usuario.getIdUsuario(), idGrupo))
                .orElseThrow(() -> new AccessDeniedException("No perteneces a este grupo"));
    }

    /**
     * Comprueba que el solicitante tiene al menos el rol indicado en el grupo.
     * SUPER_ADMIN=0 es el más alto; pasa si caller.ordinal() <= required.ordinal().
     */
    private void verifyRolMinimo(Long idGrupo, String email, GroupRole rolMinimo, String action) {
        GroupMember miembro = getMiembroActivoOrThrow(idGrupo, email);
        if (miembro.getRol().ordinal() > rolMinimo.ordinal()) {
            throw new AccessDeniedException("Se requiere rol " + rolMinimo + " o superior para " + action);
        }
    }

    /** Devuelve el miembro objetivo o lanza 404 si no pertenece al grupo. */
    private GroupMember getTargetMiembroOrThrow(Long idUsuario, Long idGrupo) {
        return miembrosGroupRepository
                .findById(new GroupMemberId(idUsuario, idGrupo))
                .orElseThrow(() -> new NoSuchElementException("El usuario no es miembro de este grupo"));
    }

    @Transactional(readOnly = true)
    public List<MemberDto> obtenerMiembros(Long idGrupo, String email) {
        Group grupo = grupoRepository.getByIdOrThrow(idGrupo);
        verifyGrupoAccess(grupo, email);

        return miembrosGroupRepository.findMiembrosByGrupoId(idGrupo)
                .stream()
                .map(mg -> {
                    String rawAvatar = mg.getUsuario().getAvatarUrl();
                    String avatarUrl = (rawAvatar != null && !rawAvatar.isBlank())
                            ? "/api/usuarios/avatars/" + rawAvatar
                            : null;
                    return new MemberDto(
                            mg.getUsuario().getIdUsuario(),
                            mg.getUsuario().getUsername(),
                            mg.getUsuario().getTag(),
                            mg.getRol(),
                            avatarUrl);
                })
                .toList();
    }

    @Transactional
    public Group crearGrupo(String emailCreador, String nombre) {
        User creador = userRepository.getByEmailOrThrow(emailCreador);
        Group grupo = new Group();
        grupo.setNombre(nombre);
        grupo.setCreador(creador);
        Group guardado = grupoRepository.save(grupo);

        miembrosGroupRepository.save(
                new GroupMember(creador.getIdUsuario(), guardado.getIdGrupo(), GroupRole.SUPER_ADMIN));
        return guardado;
    }

    @Transactional
    public void aniadirMiembro(Long idGrupo, String emailSolicitante, String identificadorInvitado) {
        verifyRolMinimo(idGrupo, emailSolicitante, GroupRole.ADMIN, "añadir miembros");

        User invitado = userService.buscarPorIdentificador(identificadorInvitado);
        if (invitado == null) {
            throw new NoSuchElementException("Usuario no encontrado: " + identificadorInvitado);
        }
        GroupMemberId miembroId = new GroupMemberId(invitado.getIdUsuario(), idGrupo);
        if (miembrosGroupRepository.existsById(miembroId)) {
            throw new IllegalArgumentException("El usuario ya es miembro del grupo");
        }

        GroupMember miembro = new GroupMember();
        miembro.setId(miembroId);
        miembro.setRol(GroupRole.MIEMBRO);
        miembrosGroupRepository.save(miembro);
    }

    @Transactional
    public void eliminarMiembro(Long idGrupo, Long idUsuario, String emailSolicitante) {
        GroupMember solicitante = getMiembroActivoOrThrow(idGrupo, emailSolicitante);
        GroupRole rolSolicitante = solicitante.getRol();

        if (rolSolicitante != GroupRole.SUPER_ADMIN && rolSolicitante != GroupRole.ADMIN) {
            throw new AccessDeniedException("Se requiere rol ADMIN o superior para eliminar miembros");
        }
        GroupMember objetivo = getTargetMiembroOrThrow(idUsuario, idGrupo);
        if (objetivo.getRol() == GroupRole.SUPER_ADMIN) {
            throw new AccessDeniedException("El SUPER_ADMIN (creador del grupo) no puede ser expulsado");
        }
        if (rolSolicitante == GroupRole.ADMIN && objetivo.getRol() == GroupRole.ADMIN) {
            throw new AccessDeniedException("Un ADMIN no puede expulsar a otro ADMIN");
        }
        miembrosGroupRepository.deleteByGrupoIdAndUsuarioId(idGrupo, idUsuario);
    }

    @Transactional
    public Group renombrarGrupo(Long idGrupo, String nuevoNombre, String emailSolicitante) {
        // Defensa en profundidad: aunque el controller usa Bean Validation,
        // validamos también aquí para que llamadas directas al service no
        // puedan persistir nombres vacíos o demasiado largos.
        if (nuevoNombre == null || nuevoNombre.isBlank()) {
            throw new IllegalArgumentException("El nombre del grupo es obligatorio");
        }
        String nombreLimpio = nuevoNombre.trim();
        if (nombreLimpio.length() > 100) {
            throw new IllegalArgumentException("El nombre del grupo no puede superar los 100 caracteres");
        }
        verifyRolMinimo(idGrupo, emailSolicitante, GroupRole.ADMIN, "cambiar el nombre del grupo");
        Group grupo = grupoRepository.getByIdOrThrow(idGrupo);
        grupo.setNombre(nombreLimpio);
        return grupoRepository.save(grupo);
    }

    /**
     * Elimina el grupo. Los vídeos asignados al grupo quedan como privados
     * (se borran sus permisos). Los logs históricos conservan los datos de
     * reproducción pero pierden la referencia al grupo (id_grupo → NULL) para
     * no dejar FKs huérfanas ni borrar el historial del usuario.
     */
    @Transactional
    public void eliminarGrupo(Long idGrupo, String emailSolicitante) {
        verifyRolMinimo(idGrupo, emailSolicitante, GroupRole.SUPER_ADMIN, "eliminar el grupo");

        // Primero limpiamos referencias en logs (SET NULL) para conservar historial.
        logRepository.nullifyGrupoId(idGrupo);
        miembrosGroupRepository.deleteByGrupoId(idGrupo);
        permisosGroupRepository.deleteByGrupoId(idGrupo);
        Group grupo = grupoRepository.getByIdOrThrow(idGrupo);
        grupoRepository.delete(grupo);
    }

    @Transactional
    public void cambiarRolMiembro(Long idGrupo, String emailAdmin,
                                  Long idUsuarioObjetivo, GroupRole nuevoRol) {
        GroupMember adminMiembro = getMiembroActivoOrThrow(idGrupo, emailAdmin);
        GroupRole rolAdmin = adminMiembro.getRol();

        if (rolAdmin != GroupRole.SUPER_ADMIN && rolAdmin != GroupRole.ADMIN) {
            throw new AccessDeniedException("Se requiere rol ADMIN o superior para cambiar roles");
        }

        GroupMember objetivo = getTargetMiembroOrThrow(idUsuarioObjetivo, idGrupo);

        if (objetivo.getRol() == GroupRole.SUPER_ADMIN) {
            throw new AccessDeniedException("El rol SUPER_ADMIN (creador del grupo) es inmutable");
        }
        if (nuevoRol == GroupRole.SUPER_ADMIN) {
            throw new AccessDeniedException("No se puede asignar el rol SUPER_ADMIN: hay uno único por grupo (el creador)");
        }
        if (rolAdmin == GroupRole.ADMIN && objetivo.getRol() == GroupRole.ADMIN) {
            throw new AccessDeniedException("Un ADMIN no puede modificar a otro ADMIN");
        }
        if (rolAdmin == GroupRole.ADMIN && nuevoRol == GroupRole.ADMIN) {
            throw new AccessDeniedException("Un ADMIN no puede asignar el rol ADMIN");
        }

        objetivo.setRol(nuevoRol);
        miembrosGroupRepository.save(objetivo);
    }

    @Transactional
    public Group actualizarImagenGrupo(Long idGrupo, String email, MultipartFile file) throws IOException {
        Group grupo = grupoRepository.getByIdOrThrow(idGrupo);
        verificarEsCreador(grupo, email);
        userService.validateImageFile(file);

        Path baseDir = Paths.get(gruposImgDir).toAbsolutePath().normalize();
        Files.createDirectories(baseDir);

        String ext      = userService.getImageExtension(file.getContentType());
        String fileName = UUID.randomUUID() + "." + ext;

        String old = grupo.getImagenUrl();
        if (old != null && !old.isBlank()) {
            String oldFileName = old.substring(old.lastIndexOf('/') + 1);
            try { Files.deleteIfExists(baseDir.resolve(oldFileName).normalize()); } catch (IOException ignored) {}
        }

        file.transferTo(baseDir.resolve(fileName));
        grupo.setImagenUrl("/api/grupos/imagenes/" + fileName);
        return grupoRepository.save(grupo);
    }

    @Transactional
    public void quitarVideoDelGrupo(Long idGrupo, Long idVideo, String emailSolicitante) {
        verifyRolMinimo(idGrupo, emailSolicitante, GroupRole.EDITOR, "quitar vídeos del grupo");
        permisosGroupRepository.deleteByVideoIdAndGrupoId(idVideo, idGrupo);
    }

    private void verificarEsCreador(Group grupo, String email) {
        if (!grupo.getCreador().getEmail().equals(email)) {
            throw new AccessDeniedException("Solo el creador puede modificar la imagen del grupo");
        }
    }
}