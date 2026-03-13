from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import Category

DEFAULT_CATEGORIES = [
    {"name": "Food & Dining", "icon": "🍽️", "color": "#ef4444", "children": [
        {"name": "Restaurants", "icon": "🍜", "color": "#ef4444"},
        {"name": "Groceries", "icon": "🛒", "color": "#f97316"},
        {"name": "Coffee & Tea", "icon": "☕", "color": "#d97706"},
    ]},
    {"name": "Transport", "icon": "🚌", "color": "#3b82f6", "children": [
        {"name": "Public Transit", "icon": "🚇", "color": "#3b82f6"},
        {"name": "Taxi & Ride Share", "icon": "🚕", "color": "#6366f1"},
        {"name": "Fuel", "icon": "⛽", "color": "#8b5cf6"},
    ]},
    {"name": "Shopping", "icon": "🛍️", "color": "#ec4899", "children": [
        {"name": "Clothing", "icon": "👕", "color": "#ec4899"},
        {"name": "Electronics", "icon": "📱", "color": "#a855f7"},
        {"name": "Home & Garden", "icon": "🏠", "color": "#14b8a6"},
    ]},
    {"name": "Bills & Utilities", "icon": "📄", "color": "#f59e0b", "children": [
        {"name": "Rent", "icon": "🏠", "color": "#f59e0b"},
        {"name": "Electricity", "icon": "⚡", "color": "#eab308"},
        {"name": "Internet & Phone", "icon": "📶", "color": "#84cc16"},
        {"name": "Insurance", "icon": "🛡️", "color": "#22c55e"},
    ]},
    {"name": "Entertainment", "icon": "🎬", "color": "#a855f7", "children": [
        {"name": "Streaming", "icon": "📺", "color": "#a855f7"},
        {"name": "Games", "icon": "🎮", "color": "#7c3aed"},
        {"name": "Events", "icon": "🎫", "color": "#6d28d9"},
    ]},
    {"name": "Health & Fitness", "icon": "💪", "color": "#10b981", "children": [
        {"name": "Medical", "icon": "🏥", "color": "#10b981"},
        {"name": "Gym", "icon": "🏋️", "color": "#059669"},
        {"name": "Pharmacy", "icon": "💊", "color": "#047857"},
    ]},
    {"name": "Income", "icon": "💰", "color": "#22c55e", "children": [
        {"name": "Salary", "icon": "💵", "color": "#22c55e"},
        {"name": "Investment", "icon": "📈", "color": "#16a34a"},
        {"name": "Other Income", "icon": "💸", "color": "#15803d"},
    ]},
    {"name": "Transfer", "icon": "🔄", "color": "#6b7280"},
    {"name": "Other", "icon": "📌", "color": "#9ca3af"},
]


async def seed_categories(db: AsyncSession):
    """Seed default categories if none exist."""
    result = await db.execute(select(Category).limit(1))
    if result.scalar_one_or_none() is not None:
        return  # Already seeded

    for cat_data in DEFAULT_CATEGORIES:
        children = cat_data.pop("children", [])
        parent = Category(**cat_data)
        db.add(parent)
        await db.flush()
        for child_data in children:
            child = Category(parent_id=parent.id, **child_data)
            db.add(child)

    await db.commit()
