# services/tiptap.py
import json

def extract_plain_text(j):
    if isinstance(j,str):
        try: doc=json.loads(j)
        except: return j
    else: doc=j
    lines=[]
    _walk(doc,lines)
    return '\n'.join(l for l in lines if l.strip())

def _walk(node,lines):
    t=node.get('type','')
    if t=='text':
        text=node.get('text','')
        if lines: lines[-1]+=text
        else: lines.append(text)
        return
    if t in {'paragraph','heading','listItem','taskItem','blockquote','codeBlock'}:
        lines.append('')
    for c in node.get('content',[]): _walk(c,lines)
    if t=='hardBreak': lines.append('')

def tiptap_to_markdown(j):
    if isinstance(j,str):
        try: doc=json.loads(j)
        except: return j
    else: doc=j
    lines=[]
    _md(doc,lines)
    return '\n'.join(lines)

def _md(node,lines):
    t=node.get('type','')
    content=node.get('content',[])
    attrs=node.get('attrs',{})
    if t=='text':
        marks={m['type'] for m in node.get('marks',[])}
        tx=node.get('text','')
        if 'bold' in marks: tx=f'**{tx}**'
        if 'italic' in marks: tx=f'*{tx}*'
        if 'code' in marks: tx=f'`{tx}`'
        if lines: lines[-1]+=tx
        else: lines.append(tx)
        return
    if t=='heading': lines.append('#'*attrs.get('level',1)+' ')
    elif t=='paragraph': lines.append('')
    elif t=='bulletList':
        for item in content:
            lines.append('- ')
            for c in item.get('content',[]): _md(c,lines)
        return
    elif t=='orderedList':
        for i,item in enumerate(content,1):
            lines.append(f'{i}. ')
            for c in item.get('content',[]): _md(c,lines)
        return
    elif t=='taskList':
        for item in content:
            ch=item.get('attrs',{}).get('checked',False)
            lines.append('- [x] ' if ch else '- [ ] ')
            for c in item.get('content',[]): _md(c,lines)
        return
    elif t=='blockquote': lines.append('> ')
    elif t=='codeBlock': lines.append(f'```{attrs.get("language","")}'); [_md(c,lines) for c in content]; lines.append('```'); return
    elif t=='horizontalRule': lines.append('---'); return
    elif t=='hardBreak': lines.append(''); return
    for c in content: _md(c,lines)