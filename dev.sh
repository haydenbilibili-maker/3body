#!/usr/bin/env bash
# 兼容旧入口：等同于 ./start.sh
exec "$(dirname "$0")/start.sh" "$@"
