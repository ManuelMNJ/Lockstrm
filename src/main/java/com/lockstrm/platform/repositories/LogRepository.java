package com.lockstrm.platform.repositories;

import com.lockstrm.platform.dto.GrupoVideoStatsDto;
import com.lockstrm.platform.entities.Log;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.entities.Video;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LogRepository extends JpaRepository<Log, Long> {

    List<Log> findByUsuario(Usuario usuario);

    /**
     * Fila de `logs` que identifica la combinación (usuario, vídeo, grupo).
     * Es la clave lógica del UPSERT del heartbeat: un mismo vídeo visto desde
     * dos grupos distintos genera dos filas independientes. `grupoId` puede
     * ser null (reproducción fuera de un grupo), por eso usamos JPQL con
     * comparación tolerante a null en lugar del derived query
     * `findByUsuarioAndVideoAndGrupoId`, que traduciría null a `= NULL` y
     * nunca casaría.
     */
    @Query("""
            SELECT l FROM Log l
            WHERE l.usuario.idUsuario = :usuarioId
              AND l.video.idVideo     = :videoId
              AND ((:grupoId IS NULL AND l.grupoId IS NULL)
                   OR l.grupoId = :grupoId)
            """)
    Optional<Log> findByUsuarioIdAndVideoIdAndGrupoId(@Param("usuarioId") Long usuarioId,
                                                     @Param("videoId")   Long videoId,
                                                     @Param("grupoId")   Long grupoId);

    /** Sobrecarga que recibe entidades en lugar de IDs (más cómoda en LogService). */
    default Optional<Log> findByUsuarioVideoYGrupo(Usuario usuario, Video video, Long grupoId) {
        return findByUsuarioIdAndVideoIdAndGrupoId(usuario.getIdUsuario(), video.getIdVideo(), grupoId);
    }

    @Modifying
    @Query("DELETE FROM Log l WHERE l.video.idVideo = :idVideo")
    void deleteByVideoId(@Param("idVideo") Long idVideo);

    /**
     * Segundos máximos de reproducción alcanzados por cada usuario en un vídeo.
     * Si `grupoId` viene a null se devuelve el agregado global (todos los
     * contextos); si trae un id concreto, la consulta se acota a las sesiones
     * generadas dentro de ese grupo. La condición `(:grupoId IS NULL OR ...)`
     * evita duplicar el método y mantiene un solo plan de ejecución parametrizado.
     */
    @Query("""
            SELECT l.usuario.email AS email,
                   MAX(l.segundosVistos) AS segundos
            FROM Log l
            WHERE l.video.idVideo = :idVideo
              AND l.segundosVistos IS NOT NULL
              AND (:grupoId IS NULL OR l.grupoId = :grupoId)
            GROUP BY l.usuario.email
            """)
    List<SegundosPorUsuario> findSegundosVistos(@Param("idVideo") Long idVideo,
                                                @Param("grupoId") Long grupoId);

    interface SegundosPorUsuario {
        String  getEmail();
        Integer getSegundos();
    }

    /**
     * Listado de logs del vídeo. Si `grupoId` es null devuelve todos los
     * registros (cualquier contexto); si trae un id, filtra a ese grupo.
     */
    @Query("""
            SELECT l FROM Log l
            JOIN FETCH l.usuario
            WHERE l.video.idVideo = :idVideo
              AND (:grupoId IS NULL OR l.grupoId = :grupoId)
            ORDER BY l.fechaHora DESC
            """)
    List<Log> findLogsByVideoId(@Param("idVideo") Long idVideo,
                                @Param("grupoId") Long grupoId);

    /**
     * Estadísticas agregadas por vídeo para la pestaña "Analíticas" del
     * detalle del grupo: una fila por cada vídeo del grupo con espectadores
     * únicos y tiempo total visto, restringido al contexto del grupo.
     *
     * - LEFT JOIN con `Log` para que también aparezcan los vídeos sin
     *   reproducciones (se devuelven con 0/0).
     * - El JOIN con PermisosGrupo asegura que solo entran vídeos compartidos
     *   con el grupo indicado; aunque el vídeo esté en otros grupos, esta
     *   consulta no los mezcla porque filtra `l.grupoId = :idGrupo`.
     */
    @Query("""
            SELECT new com.lockstrm.platform.dto.GrupoVideoStatsDto(
                v.idVideo,
                v.titulo,
                v.miniaturaUrl,
                v.duracion,
                COUNT(DISTINCT l.usuario.idUsuario),
                COALESCE(SUM(l.segundosVistos), 0)
            )
            FROM Video v
            JOIN PermisosGrupo pg ON pg.id.idVideoId = v.idVideo
            LEFT JOIN Log l ON l.video = v AND l.grupoId = :idGrupo
            WHERE pg.id.idGrupoId = :idGrupo
            GROUP BY v.idVideo, v.titulo, v.miniaturaUrl, v.duracion
            ORDER BY v.fechaSubida DESC
            """)
    List<GrupoVideoStatsDto> statsPorVideoEnGrupo(@Param("idGrupo") Long idGrupo);

    @Query("""
            SELECT AVG(
                     CASE
                       WHEN l.segundosVistos >= v.duracion THEN 100.0
                       ELSE l.segundosVistos * 100.0 / v.duracion
                     END
                   )
            FROM Log l JOIN l.video v
            WHERE v.propietario.email = :email
              AND l.segundosVistos IS NOT NULL
              AND v.duracion       IS NOT NULL
              AND v.duracion > 0
            """)
    Double avgRetencionByOwnerEmail(@Param("email") String email);
}
