package com.lockstrm.platform.repositories;

import com.lockstrm.platform.dto.GroupVideoStatsDto;
import com.lockstrm.platform.entities.Log;
import com.lockstrm.platform.entities.User;
import com.lockstrm.platform.entities.Video;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;

@Repository
public interface LogRepository extends JpaRepository<Log, Long> {

    /**
     * Fila de `logs` que identifica una sesión concreta del reproductor:
     * (usuario, vídeo, grupo, sessionId). El sessionId se genera en cliente
     * al montar el <video-player>, por lo que cada apertura del reproductor
     * produce una fila independiente — incluso si el mismo usuario ve el
     * mismo vídeo desde el mismo grupo varias veces.
     *
     * grupoId puede ser null (reproducción fuera de un grupo). JPQL con
     * comparación tolerante a null para que `(... AND l.grupoId IS NULL)`
     * case correctamente.
     */
    @Query("""
            SELECT l FROM Log l
            WHERE l.usuario.idUsuario = :usuarioId
              AND l.video.idVideo     = :videoId
              AND l.sessionId         = :sessionId
              AND ((:grupoId IS NULL AND l.grupoId IS NULL)
                   OR l.grupoId = :grupoId)
            """)
    Optional<Log> findByUsuarioIdAndVideoIdAndGrupoIdAndSessionId(
            @Param("usuarioId") Long   usuarioId,
            @Param("videoId")   Long   videoId,
            @Param("grupoId")   Long   grupoId,
            @Param("sessionId") String sessionId);

    /** Sobrecarga por entidades para uso cómodo desde el servicio. */
    default Optional<Log> findSesion(User usuario, Video video, Long grupoId, String sessionId) {
        return findByUsuarioIdAndVideoIdAndGrupoIdAndSessionId(
                usuario.getIdUsuario(), video.getIdVideo(), grupoId, sessionId);
    }

    @Modifying
    @Query("DELETE FROM Log l WHERE l.video.idVideo = :idVideo")
    void deleteByVideoId(@Param("idVideo") Long idVideo);

    /**
     * Limpia la referencia al grupo eliminado en los logs históricos.
     * Se usa SET NULL en lugar de DELETE para conservar el historial de
     * reproducción — la sesión sigue siendo válida aunque el grupo ya no exista.
     * El id_grupo se vuelve null, con lo que esas filas se suman al agregado
     * global (sin contexto de grupo) en las consultas analíticas futuras.
     */
    @Modifying
    @Query("UPDATE Log l SET l.grupoId = NULL WHERE l.grupoId = :idGrupo")
    void nullifyGrupoId(@Param("idGrupo") Long idGrupo);

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
              AND (:grupoId IS NULL OR l.grupoId  = :grupoId)
              AND (:desde   IS NULL OR l.fechaHora >= :desde)
              AND (:hasta   IS NULL OR l.fechaHora <= :hasta)
            ORDER BY l.fechaHora DESC
            """)
    List<Log> findLogsByVideoId(@Param("idVideo") Long          idVideo,
                                @Param("grupoId") Long          grupoId,
                                @Param("desde")   LocalDateTime desde,
                                @Param("hasta")   LocalDateTime hasta);

    /**
     * Estadísticas agregadas por vídeo para la pestaña "Analíticas" del
     * detalle del grupo, con sesiones independientes (ahora que el UPSERT
     * incluye sessionId, cada apertura del reproductor es una fila).
     *
     * Métricas devueltas por vídeo, todas acotadas al contexto del grupo:
     *   - visitasTotales: cada apertura del reproductor cuenta una.
     *   - espectadoresUnicos: usuarios distintos que abrieron al menos una
     *     sesión.
     *   - tiempoTotalSegundos: suma bruta — métrica secundaria de "consumo
     *     agregado", útil para comparativas pero engañosa por sí sola.
     *   - duracionMediaSegundos: AVG por sesión. Esto es lo que de verdad te
     *     dice "cuánto tiempo le presta atención la gente cuando lo abre".
     *   - porcentajeCompletadoMedio: AVG capado al 100 % por sesión, así una
     *     persona que vio el vídeo 2 veces no aparece con 200 %.
     *   - ultimaVisita: MAX(fechaHora) — útil para detectar contenido vivo
     *     vs. olvidado.
     *
     * - LEFT JOIN con `Log` para que vídeos sin reproducciones aparezcan
     *   con 0/0 en lugar de desaparecer.
     * - COUNT(l.idLog) — no COUNT(*) — para que el LEFT JOIN sin matches
     *   devuelva 0 (COUNT(*) contaría la fila del vídeo).
     */
    /**
     * Si `autorEmail` es null devuelve TODOS los vídeos del grupo
     * (caso ADMIN/SUPER_ADMIN). Si trae un email, solo los vídeos cuyo
     * propietario es ese email — caso EDITOR, que únicamente debe ver sus
     * propios vídeos. El parámetro va siempre, controlado en el servicio
     * según el rol del solicitante; el patrón `(:autorEmail IS NULL OR ...)`
     * mantiene un único plan de ejecución.
     */
    /**
     * Filtros opcionales `desde`/`hasta` aplicados a la JOIN ON (no al WHERE)
     * para que vídeos sin sesiones en el rango sigan apareciendo con 0/0
     * — si los pusiéramos en el WHERE desaparecerían cuando la franja
     * temporal no contiene ningún log.
     */
    @Query("""
            SELECT new com.lockstrm.platform.dto.GroupVideoStatsDto(
                v.idVideo,
                v.titulo,
                v.miniaturaUrl,
                v.duracion,
                v.propietario.idUsuario,
                v.propietario.username,
                v.propietario.tag,
                COUNT(l.idLog),
                COUNT(DISTINCT l.usuario.idUsuario),
                COALESCE(SUM(l.segundosVistos), 0),
                COALESCE(AVG(l.segundosVistos), 0.0),
                COALESCE(AVG(
                    CASE
                        WHEN v.duracion IS NULL OR v.duracion = 0 THEN 0.0
                        WHEN l.segundosVistos >= v.duracion       THEN 100.0
                        ELSE (l.segundosVistos * 100.0) / v.duracion
                    END
                ), 0.0),
                MAX(l.fechaHora)
            )
            FROM Video v
            JOIN GroupPermission pg ON pg.id.idVideoId = v.idVideo
            LEFT JOIN Log l ON l.video = v
                AND l.grupoId = :idGrupo
                AND (:desde IS NULL OR l.fechaHora >= :desde)
                AND (:hasta IS NULL OR l.fechaHora <= :hasta)
            WHERE pg.id.idGrupoId = :idGrupo
              AND (:autorEmail IS NULL OR v.propietario.email = :autorEmail)
            GROUP BY v.idVideo, v.titulo, v.miniaturaUrl, v.duracion, v.fechaSubida,
                     v.propietario.idUsuario, v.propietario.username, v.propietario.tag
            ORDER BY v.fechaSubida DESC
            """)
    List<GroupVideoStatsDto> statsPorVideoEnGrupo(@Param("idGrupo")    Long          idGrupo,
                                                  @Param("autorEmail") String        autorEmail,
                                                  @Param("desde")      LocalDateTime desde,
                                                  @Param("hasta")      LocalDateTime hasta);

    /**
     * Visitas por día (último N días) para sparklines de la tabla. Devuelve
     * una fila por (vídeo, día) con conteo. El servicio la convierte en
     * arrays ya alineados a un calendario fijo.
     */
    interface DiaVisitasRow {
        Long      getIdVideo();
        LocalDate getFecha();
        Long      getVisitas();
    }

    @Query("""
            SELECT v.idVideo                    AS idVideo,
                   CAST(l.fechaHora AS date)    AS fecha,
                   COUNT(l.idLog)               AS visitas
            FROM Log l
            JOIN l.video v
            JOIN GroupPermission pg ON pg.id.idVideoId = v.idVideo
            WHERE pg.id.idGrupoId = :idGrupo
              AND l.grupoId       = :idGrupo
              AND l.fechaHora    >= :desde
              AND (:autorEmail IS NULL OR v.propietario.email = :autorEmail)
            GROUP BY v.idVideo, CAST(l.fechaHora AS date)
            """)
    List<DiaVisitasRow> visitasPorDia(@Param("idGrupo")    Long          idGrupo,
                                      @Param("autorEmail") String        autorEmail,
                                      @Param("desde")      LocalDateTime desde);

    /**
     * IDs de los grupos a los que el usuario ha accedido más recientemente
     * (medido por MAX fechaHora de sus sesiones en cada grupo).
     * Solo incluye entradas con grupoId no nulo — las sesiones fuera de un
     * grupo (reproducción privada del propietario) se ignoran.
     * El Pageable permite limitar el resultado a N grupos en la capa de servicio.
     */
    @Query("""
            SELECT l.grupoId
            FROM Log l
            WHERE l.usuario.email = :email
              AND l.grupoId IS NOT NULL
            GROUP BY l.grupoId
            ORDER BY MAX(l.fechaHora) DESC
            """)
    List<Long> findGruposRecientesByEmail(@Param("email") String email, Pageable pageable);

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
