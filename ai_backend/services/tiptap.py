import json


def _validate(j):
    """Parse JSON string nếu cần, raise ValueError nếu không hợp lệ."""
    if isinstance(j, str):
        try:
            doc = json.loads(j)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid TipTap JSON: {e}") from e
    else:
        doc = j
    if not isinstance(doc, dict):
        raise ValueError("TipTap document must be a JSON object")
    return doc


# ── Plain-text extraction ────────────────────────────────────────────────────

def extract_plain_text(j) -> str:
    doc = _validate(j)
    lines: list[str] = []
    _walk(doc, lines)
    return "\n".join(l for l in lines if l.strip())


def _walk(node: dict, lines: list[str]) -> None:
    t = node.get("type", "")

    # Leaf text node
    if t == "text":
        text = node.get("text", "")
        if lines:
            lines[-1] += text
        else:
            lines.append(text)
        return

    # Custom media/file nodes (atom, no children)
    if t == "audioNode":
        name = node.get("attrs", {}).get("name", "")
        lines.append(f"[Âm thanh{': ' + name if name else ''}]")
        return
    if t == "videoNode":
        name = node.get("attrs", {}).get("name", "")
        lines.append(f"[Video{': ' + name if name else ''}]")
        return
    if t == "fileNode":
        name = node.get("attrs", {}).get("name", "")
        lines.append(f"[File đính kèm{': ' + name if name else ''}]")
        return
    if t == "image":
        alt = node.get("attrs", {}).get("alt", "")
        lines.append(f"[Hình ảnh{': ' + alt if alt else ''}]")
        return

    # Block nodes that start a new line
    if t in {"paragraph", "heading", "listItem", "taskItem",
             "blockquote", "codeBlock", "tableRow"}:
        lines.append("")

    # Table cell separator — append space so cells don't merge
    if t in {"tableCell", "tableHeader"}:
        if lines and lines[-1] and not lines[-1].endswith(" "):
            lines[-1] += "  "

    for c in node.get("content", []):
        _walk(c, lines)

    if t == "hardBreak":
        lines.append("")
    if t == "tableRow":
        lines.append("")

