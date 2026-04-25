package com.lockstrm.platform.services;

import com.lockstrm.platform.dto.MiembroDto;
import com.lockstrm.platform.entities.Grupo;
import com.lockstrm.platform.entities.MiembrosGrupo;
import com.lockstrm.platform.entities.MiembrosGrupoId;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.enums.RolGrupo;
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
    private final UserService             userService;

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

    @Transactional(readOnly = true)
    public List<Grupo> obtenerGruposCreados(String email) {
        return grupoRepository.findByCreador_Email(email);
    }

    /** Grupos disponibles para asignar a un vídeo: solo donde el usuario es PROPIETARIO. */
    @Transactional(readOnly = true)
    public List<Grupo> obtenerGruposParaDesplegable(String email) {
        return grupoRepository.findByCreador_Email(email);
    }

    @Transactional(readOnly = true)
    public List<Grupo> obtenerGruposComoMiembro(String email) {
        return miembrosGrupoRepository.findGruposComoMiembroNoCreador(email);
    }

    @Transactional(readOnly = true)
    public Grupo obtenerDetalle(Long idGrupo, String email) {
        Grupo grupo = grupoRepository.getByIdOrThrow(idGrupo);
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

    private MiembrosGrupo getMiembroActivoOrThrow(Long idGrupo, String email) {
        Usuario usuario = userRepository.getByEmailOrThrow(email);
        return miembrosGrupoRepository
                .findById(new MiembrosGrupoId(usuario.getIdUsuario(), idGrupo))
                .orElseThrow(() -> new AccessDeniedException("No perteneces a este grupo"));
    }

    /**
     * Verifies the caller has at least the required role in the group.
     * SUPER_ADMIN=0 is highest; ordinal comparison: caller.ordinal() <= required.ordinal() passes.
     */
    private void verifyRolMinimo(Long idGrupo, String email, RolGrupo rolMinimo, String action) {
        MiembrosGrupo miembro = getMiembroActivoOrThrow(idGrupo, email);
        if (miembro.getRol().ordinal() > rolMinimo.ordinal()) {
            throw new AccessDeniedException("Se requiere rol " + rolMinimo + " o superior para " + action);
        }
    }

    /** Returns the target member record or 404 if not found in the group. */
    private MiembrosGrupo getTargetMiembroOrThrow(Long idUsuario, Long idGrupo) {
        return miembrosGrupoRepository
                .findById(new MiembrosGrupoId(idUsuario, idGrupo))
                .orElseThrow(() -> new NoSuchElementException("El usuario no es miembro de este grupo"));
    }

    @Transactional(readOnly = true)
    public List<MiembroDto> obtenerMiembros(Long idGrupo, String email) {
        Grupo grupo = grupoRepository.getByIdOrThrow(idGrupo);
        verifyGrupoAccess(grupo, email);

        return miembrosGrupoRepository.findMiembrosByGrupoId(idGrupo)
                .stream()
                .map(mg -> new MiembroDto(
                        mg.getUsuario().getIdUsuario(),
                        mg.getUsuario().getUsername(),
                        mg.getUsuario().getTag(),
                        mg.getRol()))
                .toList();
    }

    @Transactional
    public Grupo crearGrupo(String emailCreador, String nombre) {
        Usuario creador = userRepository.getByEmailOrThrow(emailCreador);
        Grupo grupo = new Grupo();
        grupo.setNombre(nombre);
        grupo.setCreador(creador);
        Grupo guardado = grupoRepository.save(grupo);

        // ASIGNACIÓN DE SUPER_ADMIN POR DEFECTO AL CREADOR
        miembrosGrupoRepository.save(
                new MiembrosGrupo(creador.getIdUsuario(), guardado.getIdGrupo(), RolGrupo.SUPER_ADMIN));
        return guardado;
    }

    @Transactional
    public void aniadirMiembro(Long idGrupo, String emailSolicitante, String identificadorInvitado) {
        verifyRolMinimo(idGrupo, emailSolicitante, RolGrupo.ADMIN, "añadir miembros");

        Usuario invitado = userService.buscarPorIdentificador(identificadorInvitado);
        if (invitado == null) {
            throw new NoSuchElementException("Usuario no encontrado: " + identificadorInvitado);
        }
        MiembrosGrupoId miembroId = new MiembrosGrupoId(invitado.getIdUsuario(), idGrupo);
        if (miembrosGrupoRepository.existsById(miembroId)) {
            throw new IllegalArgumentException("El usuario ya es miembro del grupo");
        }

        // ASIGNAMOS ROL MIEMBRO POR DEFECTO AL NUEVO INVITADO
        MiembrosGrupo miembro = new MiembrosGrupo();
        miembro.setId(miembroId);
        miembro.setRol(RolGrupo.MIEMBRO);
        miembrosGrupoRepository.save(miembro);
    }

    @Transactional
    public void eliminarMiembro(Long idGrupo, Long idUsuario, String emailSolicitante) {
        MiembrosGrupo solicitante = getMiembroActivoOrThrow(idGrupo, emailSolicitante);
        RolGrupo rolSolicitante = solicitante.getRol();

        if (rolSolicitante != RolGrupo.SUPER_ADMIN && rolSolicitante != RolGrupo.ADMIN) {
            throw new AccessDeniedException("Se requiere rol ADMIN o superior para eliminar miembros");
        }
        MiembrosGrupo objetivo = getTargetMiembroOrThrow(idUsuario, idGrupo);
        if (objetivo.getRol() == RolGrupo.SUPER_ADMIN) {
            throw new AccessDeniedException("El SUPER_ADMIN (creador del grupo) no puede ser expulsado");
        }
        if (rolSolicitante == RolGrupo.ADMIN && objetivo.getRol() == RolGrupo.ADMIN) {
            throw new AccessDeniedException("Un ADMIN no puede expulsar a otro ADMIN");
        }
        miembrosGrupoRepository.deleteByGrupoIdAndUsuarioId(idGrupo, idUsuario);
    }

    @Transactional
    public Grupo renombrarGrupo(Long idGrupo, String nuevoNombre, String emailSolicitante) {
        verifyRolMinimo(idGrupo, emailSolicitante, RolGrupo.ADMIN, "cambiar el nombre del grupo");
        Grupo grupo = grupoRepository.getByIdOrThrow(idGrupo);
        grupo.setNombre(nuevoNombre.trim());
        return grupoRepository.save(grupo);
    }

    /** Los vídeos asignados al grupo quedan como privados al eliminarlo. */
    @Transactional
    public void eliminarGrupo(Long idGrupo, String emailSolicitante) {
        verifyRolMinimo(idGrupo, emailSolicitante, RolGrupo.SUPER_ADMIN, "eliminar el grupo");

        miembrosGrupoRepository.deleteByGrupoId(idGrupo);
        permisosGrupoRepository.deleteByGrupoId(idGrupo);
        Grupo grupo = grupoRepository.getByIdOrThrow(idGrupo);
        grupoRepository.delete(grupo);
    }

    @Transactional
    public void cambiarRolMiembro(Long idGrupo, String emailAdmin,
                                  Long idUsuarioObjetivo, RolGrupo nuevoRol) {
        MiembrosGrupo adminMiembro = getMiembroActivoOrThrow(idGrupo, emailAdmin);
        RolGrupo rolAdmin = adminMiembro.getRol();

        if (rolAdmin != RolGrupo.SUPER_ADMIN && rolAdmin != RolGrupo.ADMIN) {
            throw new AccessDeniedException("Se requiere rol ADMIN o superior para cambiar roles");
        }

        MiembrosGrupo objetivo = getTargetMiembroOrThrow(idUsuarioObjetivo, idGrupo);

        if (objetivo.getRol() == RolGrupo.SUPER_ADMIN) {
            throw new AccessDeniedException("El rol SUPER_ADMIN (creador del grupo) es inmutable");
        }
        if (nuevoRol == RolGrupo.SUPER_ADMIN) {
            throw new AccessDeniedException("No se puede asignar el rol SUPER_ADMIN: hay uno único por grupo (el creador)");
        }
        if (rolAdmin == RolGrupo.ADMIN && objetivo.getRol() == RolGrupo.ADMIN) {
            throw new AccessDeniedException("Un ADMIN no puede modificar a otro ADMIN");
        }
        if (rolAdmin == RolGrupo.ADMIN && nuevoRol == RolGrupo.ADMIN) {
            throw new AccessDeniedException("Un ADMIN no puede asignar el rol ADMIN");
        }

        objetivo.setRol(nuevoRol);
        miembrosGrupoRepository.save(objetivo);
    }
}