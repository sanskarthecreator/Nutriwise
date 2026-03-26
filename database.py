import sqlite3

def initialize_db():
    # This creates a file called 'nutrition.db' in your folder
    conn = sqlite3.connect('nutrition.db')
    cursor = conn.cursor()

    # 1. Create the table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS red_flags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ingredient_name TEXT UNIQUE,
        issue TEXT,
        healthy_substitute TEXT
    )
    ''')

    # 2. Add some common hidden Indian junk-food ingredients
    bad_ingredients = [
        ("maltodextrin", "Highly processed carbohydrate, spikes blood sugar.", "Whole grains, oats, or roasted makhana."),
        ("palmolein oil", "High in saturated fats, linked to heart disease.", "Snacks cooked in cold-pressed peanut oil or baked snacks."),
        ("high fructose corn syrup", "Hidden sugar, drives insulin resistance.", "Products sweetened with jaggery or dates."),
        ("ins 319", "TBHQ preservative, potential immune system impact.", "Freshly made snacks with shorter shelf lives."),
        ("maida", "Refined wheat flour, zero fiber, spikes blood sugar.", "Whole wheat (Atta), Ragi, or Millets.")
    ]

    # Insert them into the database (ignore if they already exist)
    for item in bad_ingredients:
        try:
            cursor.execute('''
            INSERT INTO red_flags (ingredient_name, issue, healthy_substitute)
            VALUES (?, ?, ?)
            ''', item)
        except sqlite3.IntegrityError:
            pass # Skips if we already added it

    conn.commit()
    conn.close()
    print("Database built and populated successfully!")

# Run the function when we execute this file
if __name__ == "__main__":
    initialize_db()

 