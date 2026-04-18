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
import java.util.Set;

@Service
@RequiredArgsConstructor
public class GrupoService {

    private final GrupoRepository         grupoRepository;
    private final UserRepository          userRepository;
    private final MiembrosGrupoRepository miembrosGrupoRepository;
    private final PermisosGrupoRepository permisosGrupoRepository;

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

    private void verifyCreadorOnly(Grupo grupo, String email, String action) {
        if (!grupo.getCreador().getEmail().equals(email)) {
            throw new AccessDeniedException("Solo el creador del grupo puede " + action);
        }
    }

    @Transactional(readOnly = true)
    public List<MiembroDto> obtenerMiembros(Long idGrupo, String email) {
        Grupo grupo = grupoRepository.getByIdOrThrow(idGrupo);
        verifyGrupoAccess(grupo, email);

        return miembrosGrupoRepository.findMiembrosByGrupoId(idGrupo)
                .stream()
                .map(mg -> new MiembroDto(
                        mg.getUsuario().getIdUsuario(),
                        mg.getUsuario().getNombreCompleto(),
                        mg.getUsuario().getEmail(),
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

        miembrosGrupoRepository.save(
                new MiembrosGrupo(creador.getIdUsuario(), guardado.getIdGrupo(), RolGrupo.SUPER_ADMIN));
        return guardado;
    }

    @Transactional
    public void aniadirMiembro(Long idGrupo, String emailSolicitante, String emailInvitado) {
        Grupo grupo = grupoRepository.getByIdOrThrow(idGrupo);
        verifyCreadorOnly(grupo, emailSolicitante, "añadir miembros");

        Usuario invitado = userRepository.getByEmailOrThrow(emailInvitado);

        MiembrosGrupoId miembroId = new MiembrosGrupoId(invitado.getIdUsuario(), idGrupo);
        if (miembrosGrupoRepository.existsById(miembroId)) {
            throw new IllegalArgumentException("El usuario ya es miembro del grupo");
        }
        MiembrosGrupo miembro = new MiembrosGrupo();
        miembro.setId(miembroId);
        miembrosGrupoRepository.save(miembro);
    }

    @Transactional
    public void eliminarMiembro(Long idGrupo, Long idUsuario, String emailSolicitante) {
        Grupo grupo = grupoRepository.getByIdOrThrow(idGrupo);
        verifyCreadorOnly(grupo, emailSolicitante, "eliminar miembros");

        miembrosGrupoRepository.deleteByGrupoIdAndUsuarioId(idGrupo, idUsuario);
    }

    @Transactional
    public Grupo renombrarGrupo(Long idGrupo, String nuevoNombre, String emailSolicitante) {
        Grupo grupo = grupoRepository.getByIdOrThrow(idGrupo);
        verifyCreadorOnly(grupo, emailSolicitante, "cambiar su nombre");

        grupo.setNombre(nuevoNombre.trim());
        return grupoRepository.save(grupo);
    }

    /** Devuelve el registro de membresía o lanza 403 si el usuario no pertenece al grupo. */
    private MiembrosGrupo getMiembroOrThrow(Long idUsuario, Long idGrupo) {
        return miembrosGrupoRepository
                .findById(new MiembrosGrupoId(idUsuario, idGrupo))
                .orElseThrow(() -> new AccessDeniedException("No perteneces a este grupo"));
    }

    /** Los vídeos asignados al grupo quedan como privados al eliminarlo. */
    @Transactional
    public void eliminarGrupo(Long idGrupo, String emailSolicitante) {
        Grupo grupo = grupoRepository.getByIdOrThrow(idGrupo);

        Usuario solicitante = userRepository.getByEmailOrThrow(emailSolicitante);
        MiembrosGrupo miembro = getMiembroOrThrow(solicitante.getIdUsuario(), idGrupo);
        if (miembro.getRol() != RolGrupo.SUPER_ADMIN) {
            throw new AccessDeniedException("Solo el SUPER_ADMIN puede eliminar el grupo");
        }

        miembrosGrupoRepository.deleteByGrupoId(idGrupo);
        permisosGrupoRepository.deleteByGrupoId(idGrupo);
        grupoRepository.delete(grupo);
    }

    /**
     * Cambia el rol de un miembro del grupo.
     * Reglas de autorización:
     * - El solicitante debe tener rol ADMIN o SUPER_ADMIN.
     * - Un ADMIN no puede modificar ni expulsar al SUPER_ADMIN.
     * - Un ADMIN no puede asignar el rol SUPER_ADMIN.
     */
    @Transactional
    public void cambiarRolMiembro(Long idGrupo, String emailAdmin,
                                   Long idUsuarioObjetivo, RolGrupo nuevoRol) {
        Usuario admin = userRepository.getByEmailOrThrow(emailAdmin);
        MiembrosGrupo adminMiembro = getMiembroOrThrow(admin.getIdUsuario(), idGrupo);
        RolGrupo rolAdmin = adminMiembro.getRol();

        if (rolAdmin != RolGrupo.SUPER_ADMIN && rolAdmin != RolGrupo.ADMIN) {
            throw new AccessDeniedException("Se requiere rol ADMIN o superior para cambiar roles");
        }

        MiembrosGrupo objetivo = getMiembroOrThrow(idUsuarioObjetivo, idGrupo);

        if (rolAdmin == RolGrupo.ADMIN && objetivo.getRol() == RolGrupo.SUPER_ADMIN) {
            throw new AccessDeniedException("Un ADMIN no puede modificar al SUPER_ADMIN");
        }
        if (rolAdmin == RolGrupo.ADMIN && nuevoRol == RolGrupo.SUPER_ADMIN) {
            throw new AccessDeniedException("Un ADMIN no puede asignar el rol SUPER_ADMIN");
        }

        objetivo.setRol(nuevoRol);
        miembrosGrupoRepository.save(objetivo);
    }
}
