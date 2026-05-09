import json, base64
from datetime import datetime
from fastapi import APIRouter, HTTPException
from database import get_connection
from services.ollama import extract_from_text, extract_from_image
from services.tiptap import extract_plain_text

router = APIRouter()

def _upsert(conn, note_id, data, now):
    action_items = json.dumps(data.get('action_items', []), ensure_ascii=False)
    tags_json    = json.dumps(data.get('tags', []), ensure_ascii=False)
    conn.execute(
        'INSERT OR REPLACE INTO extracted_info '
        '(note_id,person_name,phone,email,organization,place_name,address,'
        'event_title,event_time,deadline,category,action_items,'
        'reminder_needed,raw_json,created_at) '
        'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [note_id, data.get('person_name'), data.get('phone'),
         data.get('email'), data.get('organization'),
         data.get('place_name'), data.get('address'),
         data.get('event_title'), data.get('event_time'),
         data.get('deadline'), data.get('category','note'),
         action_items, 1 if data.get('reminder_needed') else 0,
         json.dumps(data, ensure_ascii=False), now])
    conn.execute(
        'UPDATE notes SET tags=?, summary=?, ai_processed=1, updated_at=? WHERE id=?',
        [tags_json, data.get('summary'), now, note_id])
    if data.get('reminder_needed') and data.get('event_time'):
        ex = conn.execute('SELECT id FROM reminders WHERE note_id=?', [note_id]).fetchone()
        if not ex:
            title = data.get('event_title') or data.get('title') or 'MemoAI reminder'
            conn.execute(
                'INSERT INTO reminders (note_id,title,remind_at,created_at) VALUES (?,?,?,?)',
                [note_id, title, data['event_time'], now])
    conn.commit()

@router.post('/notes/{note_id}/analyze')
async def analyze_note(note_id: int):
    conn = get_connection()
    note = conn.execute('SELECT * FROM notes WHERE id=?', [note_id]).fetchone()
    if not note:
        conn.close()
        raise HTTPException(404, f'Note {note_id} not found')
    attachments = conn.execute(
        'SELECT * FROM note_attachments WHERE note_id=? ORDER BY created_at',
        [note_id]).fetchall()
    conn.close()
    now      = datetime.now().isoformat()
    plain    = note['content'] or ''
    if note['content_json']:
        plain = extract_plain_text(note['content_json'])
    all_texts = [plain] if plain.strip() else []
    combined  = {}
    for att in attachments:
        grp = att['file_group']
        if grp == 'image':
            try:
                import base64
                with open(att['file_path'], 'rb') as f:
                    b64 = base64.b64encode(f.read()).decode()
                res = extract_from_image(b64)
                if res.get('extracted_text'): all_texts.append(res['extracted_text'])
                for k, v in res.items():
                    if v and k not in combined: combined[k] = v
            except Exception as e: print(f'image err: {e}')
        elif grp == 'audio':
            try:
                from services.whisper import transcribe_audio
                with open(att['file_path'], 'rb') as f: audio = f.read()
                tx = transcribe_audio(audio, att['file_name'])
                if tx.strip(): all_texts.append(f'[Recording]: {tx}')
            except Exception as e: print(f'audio err: {e}')
        elif grp == 'document':
            ext = att['file_name'].rsplit('.', 1)[-1].lower()
            if ext in ('txt','md','csv','json','xml'):
                try:
                    with open(att['file_path'], 'r', encoding='utf-8', errors='ignore') as f:
                        txt = f.read(4000)
                    if txt.strip(): all_texts.append(f'[{att["file_name"]}]: {txt}')
                except Exception as e: print(f'doc err: {e}')
    combined_text = '\n\n'.join(all_texts)
    if not combined_text.strip():
        raise HTTPException(400, 'No content to analyze.')
    try:
        result = extract_from_text(combined_text)
    except Exception as e:
        raise HTTPException(500, f'AI error: {e}')
    final = {**combined, **{k: v for k, v in result.items() if v}}
    conn = get_connection()
    _upsert(conn, note_id, final, now)
    conn.close()
    return {'success': True, 'note_id': note_id, 'extracted': final}