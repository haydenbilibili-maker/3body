"""
把 RTF（如 macOS 文本编辑导出的 .rtf / 误存为 .txt 的 RTF）转换为 UTF-8 纯文本，供 RAG 入库使用。

用法（在项目根目录）：
    python scripts/rtf_to_text.py data/three_body_full.txt            # 原地转换
    python scripts/rtf_to_text.py input.rtf -o data/three_body.txt    # 输出到新文件

仅依赖标准库。支持：
- ``\\uN`` Unicode 转义（含负数形式）与 ``\\ucN`` 替代字符跳过
- ``\\'hh`` 字节转义（按 cp1252 解码，覆盖 Cocoa RTF 的弯引号、省略号、破折号等）
- ``\\par`` / ``\\line`` / 反斜杠换行 → 换行；``\\tab`` → 制表符
- 跳过字体表、颜色表、样式表、``\\*`` 可选目标等非正文分组
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# 这些分组只包含排版元数据，整组跳过
_SKIP_DESTINATIONS = {
    "fonttbl", "colortbl", "stylesheet", "info", "expandedcolortbl", "listtable",
    "listoverridetable", "rsidtbl", "generator", "header", "footer", "pict", "object",
    "themedata", "colorschememapping", "latentstyles", "datastore", "xmlnstbl",
}

_TOKEN = re.compile(
    r"\\([a-zA-Z]+)(-?\d+)? ?"   # 控制字 \word[N] 及其后可选的一个空格
    r"|\\'([0-9a-fA-F]{2})"      # \'hh
    r"|\\([^a-zA-Z])"            # 控制符号 \\ \{ \} \~ \<换行> 等
    r"|([{}])"                   # 分组
    r"|([^\\{}]+)",              # 普通文本
    re.S,
)


def rtf_to_text(rtf: str) -> str:
    if not rtf.lstrip().startswith("{\\rtf"):
        return rtf  # 不是 RTF，原样返回

    out: list[str] = []
    stack: list[tuple[bool, int]] = []  # (skip, uc)
    skip = False
    uc = 1          # \ucN：每个 \u 之后要跳过的替代字符数
    pending_skip = 0
    star_next = False

    for m in _TOKEN.finditer(rtf):
        word, arg, hexbyte, symbol, brace, text = m.groups()

        if brace == "{":
            stack.append((skip, uc))
            star_next = False
            continue
        if brace == "}":
            skip, uc = stack.pop() if stack else (False, 1)
            continue

        if word is not None:
            if star_next or word in _SKIP_DESTINATIONS:
                skip = True
                star_next = False
                continue
            if skip:
                continue
            if word == "uc":
                uc = int(arg or 1)
            elif word == "u":
                code = int(arg or 0)
                if code < 0:
                    code += 65536
                out.append(chr(code))
                pending_skip = uc
            elif word in ("par", "line", "sect", "page"):
                out.append("\n")
            elif word == "tab":
                out.append("\t")
            continue

        if symbol is not None:
            if symbol == "*":
                star_next = True
                continue
            if skip:
                continue
            if symbol in "\n\r":
                out.append("\n")
            elif symbol in "\\{}":
                out.append(symbol)
            elif symbol == "~":
                out.append("\u00a0")
            continue

        if skip:
            continue

        if hexbyte is not None:
            if pending_skip:
                pending_skip -= 1
                continue
            out.append(bytes([int(hexbyte, 16)]).decode("cp1252", errors="replace"))
            continue

        if text is not None:
            text = text.replace("\r", "").replace("\n", "")
            if pending_skip:
                drop = min(pending_skip, len(text))
                text = text[drop:]
                pending_skip -= drop
            out.append(text)

    result = "".join(out)
    # 收敛多余空行，去掉每行行尾空白
    result = "\n".join(line.rstrip() for line in result.splitlines())
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result.strip() + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="RTF → UTF-8 纯文本")
    parser.add_argument("input", type=Path)
    parser.add_argument("-o", "--output", type=Path, help="输出路径（默认原地覆盖）")
    args = parser.parse_args(argv)

    raw = args.input.read_bytes().decode("latin-1")  # RTF 本身是 7-bit ASCII
    text = rtf_to_text(raw)
    target = args.output or args.input
    target.write_text(text, encoding="utf-8")
    print(f"{args.input} → {target}：{len(text):,} 字符，{text.count(chr(10)):,} 行")
    return 0


if __name__ == "__main__":
    sys.exit(main())
