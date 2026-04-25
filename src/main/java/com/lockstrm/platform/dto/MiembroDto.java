package com.lockstrm.platform.dto;

import com.lockstrm.platform.enums.RolGrupo;

public record MiembroDto(Long idUsuario, String username, String tag, RolGrupo rol) {
    public String displayTag() {
        return username + "#" + tag;
    }
}
