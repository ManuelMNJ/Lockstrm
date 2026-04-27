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

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class GroupService {

    private final GroupRepository         grupoRepository;
    private final UserRepository          userRepository;
    private final GroupMemberRepository miembrosGroupRepository;
    private final GroupPermissionRepository permisosGroupRepository;
    private final LogRepository           logRepository;
    private final UserService             userService;

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

    @Transactional(readOnly = true)
    public List<Group> obtenerGruposCreados(String email) {
        return grupoRepository.findByCreador_Email(email);
    }

    /** Grupos disponibles para asignar a un vídeo: solo donde el usuario es PROPIETARIO. */
    @Transactional(readOnly = true)
    public List<Group> obtenerGruposParaDesplegable(String email) {
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
        boolean esCreador = grupo.getCreador().getEmail().equals(email);
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
     * Verifies the caller has at least the required role in the group.
     * SUPER_ADMIN=0 is highest; ordinal comparison: caller.ordinal() <= required.ordinal() passes.
     */
    private void verifyRolMinimo(Long idGrupo, String email, GroupRole rolMinimo, String action) {
        GroupMember miembro = getMiembroActivoOrThrow(idGrupo, email);
        if (miembro.getRol().ordinal() > rolMinimo.ordinal()) {
            throw new AccessDeniedException("Se requiere rol " + rolMinimo + " o superior para " + action);
        }
    }

    /** Returns the target member record or 404 if not found in the group. */
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
                .map(mg -> new MemberDto(
                        mg.getUsuario().getIdUsuario(),
                        mg.getUsuario().getUsername(),
                        mg.getUsuario().getTag(),
                        mg.getRol()))
                .toList();
    }

    @Transactional
    public Group crearGrupo(String emailCreador, String nombre) {
        User creador = userRepository.getByEmailOrThrow(emailCreador);
        Group grupo = new Group();
        grupo.setNombre(nombre);
        grupo.setCreador(creador);
        Group guardado = grupoRepository.save(grupo);

        // ASIGNACIÓN DE SUPER_ADMIN POR DEFECTO AL CREADOR
        miembrosGroupRepository.save(
                new GroupMember(creador.getIdUsuario(), guardado.getIdGrupo(), GroupRole.SUPER_ADMIN));
        return guardado;
    }

    @Transactional
    public void aniadirMiembro(Long idGrupo, String emailSolicitante, String identificadorInvitado) {
        verifyRolMinimo(idGrupo, emailSolicitante, GroupRole.ADMIN, "añadir miembros");

        User invitado = userService.buscarPorIdentificador(identificadorInvitado);
        if (invitado == null) {
            throw new NoSuchElementException("User no encontrado: " + identificadorInvitado);
        }
        GroupMemberId miembroId = new GroupMemberId(invitado.getIdUsuario(), idGrupo);
        if (miembrosGroupRepository.existsById(miembroId)) {
            throw new IllegalArgumentException("El usuario ya es miembro del grupo");
        }

        // ASIGNAMOS ROL MIEMBRO POR DEFECTO AL NUEVO INVITADO
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
        verifyRolMinimo(idGrupo, emailSolicitante, GroupRole.ADMIN, "cambiar el nombre del grupo");
        Group grupo = grupoRepository.getByIdOrThrow(idGrupo);
        grupo.setNombre(nuevoNombre.trim());
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
}