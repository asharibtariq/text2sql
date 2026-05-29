from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from db.schema import Base, Customer, Product, Order, OrderItem
from datetime import datetime, timedelta
import random, os
from dotenv import load_dotenv

load_dotenv()
engine = create_engine(os.getenv("DATABASE_URL"))

def seed():
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        existing = session.query(Customer).first()
        if existing:
            print("Database already seeded, skipping.")
            return
        # Customers
        customers = [
            Customer(name="Alice Khan", email="alice@example.com", country="Canada"),
            Customer(name="Bob Smith", email="bob@example.com", country="USA"),
            Customer(name="Sara Lee", email="sara@example.com", country="UK"),
            Customer(name="Omar Farooq", email="omar@example.com", country="Canada"),
            Customer(name="Emily Chen", email="emily@example.com", country="Canada"),
        ]
        session.add_all(customers)

        # Products
        products = [
            Product(name="Laptop Pro 15", category="Electronics", price=1200.0, stock=50),
            Product(name="Wireless Mouse", category="Electronics", price=25.0, stock=200),
            Product(name="Running Shoes", category="Clothing", price=80.0, stock=100),
            Product(name="Python Book", category="Books", price=35.0, stock=75),
            Product(name="Coffee Mug", category="Kitchen", price=12.0, stock=300),
        ]
        session.add_all(products)
        session.flush()

        # Orders with items
        statuses = ["delivered", "shipped", "pending", "cancelled"]
        for i, customer in enumerate(customers):
            for j in range(random.randint(1, 3)):
                order = Order(
                    customer=customer,
                    status=random.choice(statuses),
                    created_at=datetime.utcnow() - timedelta(days=random.randint(1, 180))
                )
                session.add(order)
                session.flush()

                total = 0
                for product in random.sample(products, k=random.randint(1, 3)):
                    qty = random.randint(1, 4)
                    item = OrderItem(
                        order=order,
                        product=product,
                        quantity=qty,
                        unit_price=product.price
                    )
                    total += qty * product.price
                    session.add(item)

                order.total_amount = round(total, 2)

        session.commit()
        print("Database seeded successfully.")

if __name__ == "__main__":
    seed()