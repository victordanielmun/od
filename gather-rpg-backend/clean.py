import os
import psycopg2

tables = [
    'player_stats', 
    'user_challenge_attempts', 
    'user_learning_profiles', 
    'user_achievements', 
    'recordings', 
    'user_progress', 
    'whatsapp_contacts', 
    'whatsapp_conversations', 
    'whatsapp_reminders', 
    'user_motivation_history',
    'whatsapp_messages',
    'user_items',
    'user_missions'
]

try:
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST', '127.0.0.1'),
        port=int(os.getenv('DB_PORT', '5433')),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', ''),
        dbname=os.getenv('DB_NAME', 'gather_rpg')
    )
    # Enable autocommit so we don't have to worry about rollbacks destroying previous deletes
    conn.autocommit = True
    cur = conn.cursor()
    
    cur.execute("SELECT id FROM users WHERE username LIKE 'Guest_%';")
    guests = cur.fetchall()
    
    if not guests:
        print("No guests found")
    else:
        guest_ids = tuple([g[0] for g in guests])
        
        # 1. Delete deeply nested foreign keys first
        try:
            cur.execute("DELETE FROM whatsapp_messages WHERE conversation_id IN (SELECT id FROM whatsapp_conversations WHERE user_id IN %s);", (guest_ids,))
            print("Deleted from whatsapp_messages")
        except Exception as e:
            print("Skip whatsapp_messages:", e)
            
        # 2. Delete from tables with user_id
        for table in tables:
            try:
                cur.execute(f"DELETE FROM {table} WHERE user_id IN %s;", (guest_ids,))
                print(f"Deleted from {table}")
            except Exception as e:
                print(f"Skip {table}:", e)
                
        # 3. Delete from users
        cur.execute("DELETE FROM users WHERE username LIKE 'Guest_%';")
        deleted = cur.rowcount
        print(f'Successfully deleted {deleted} guest users.')
        
except Exception as e:
    print('Error:', e)
