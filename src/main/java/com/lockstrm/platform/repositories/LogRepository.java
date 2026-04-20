package com.lockstrm.platform.repositories;

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
     * Sesión de visualización más reciente de este usuario para este vídeo.
     * `registrarAcceso()` crea un nuevo Log cada vez que el usuario arranca el
     * streaming; el heartbeat acumula segundos sobre esta última fila hasta que
     * otra reproducción abra una nueva sesión.
     */
    Optional<Log> findTopByUsuarioAndVideoOrderByFechaHoraDesc(Usuario usuario, Video video);

    @Modifying
    @Query("DELETE FROM Log l WHERE l.video.idVideo = :idVideo")
    void deleteByVideoId(@Param("idVideo") Long idVideo);

    /**
     * Retención media global (0–100 %) de todos los logs de los vídeos cuyo
     * propietario es el usuario indicado. Solo incluye sesiones con segundos
     * registrados y vídeos con duración conocida > 0.
     */
    /**
     * Segundos máximos de reproducción alcanzados por cada usuario en un vídeo.
     * Como el heartbeat hace UPSERT diario, tomamos el MAX a lo largo de todos los días
     * → representa el punto más avanzado que el usuario ha llegado a ver.
     * Devuelve (email, segundosVistos) para que el servicio lo mezcle con la lista de vistas.
     */
    @Query("""
            SELECT l.usuario.email AS email,
                   MAX(l.segundosVistos) AS segundos
            FROM Log l
            WHERE l.video.idVideo = :idVideo
              AND l.segundosVistos IS NOT NULL
            GROUP BY l.usuario.email
            """)
    List<SegundosPorUsuario> findSegundosVistosByVideoId(@Param("idVideo") Long idVideo);

    interface SegundosPorUsuario {
        String  getEmail();
        Integer getSegundos();
    }

    /**
     * Lista cada registro de la tabla `logs` del vídeo indicado con los datos
     * del usuario que lo generó, ordenado por fecha descendente. Cada fila
     * corresponde a una sesión de visualización (un usuario, un día).
     */
    @Query("""
            SELECT l FROM Log l
            JOIN FETCH l.usuario
            WHERE l.video.idVideo = :idVideo
            ORDER BY l.fechaHora DESC
            """)
    List<Log> findLogsByVideoId(@Param("idVideo") Long idVideo);

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
