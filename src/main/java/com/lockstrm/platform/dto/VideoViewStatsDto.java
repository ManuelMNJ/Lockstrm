package com.lockstrm.platform.dto;

public record VideoViewStatsDto(
        String  username,
        String  tag,
        Integer contador,
        Integer segundosVistos
) {
    public String displayTag() {
        return username + "#" + tag;
    }
}
