package com.lockstrm.platform.dto;

import com.lockstrm.platform.enums.GroupRole;

public record MemberDto(Long idUsuario, String username, String tag, GroupRole rol, String avatarUrl) {
    public String displayTag() {
        return username + "#" + tag;
    }
}
