import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from backend.database import get_db
from backend.models import CategoryRule, Transaction

router = APIRouter(prefix="/api/rules", tags=["rules"])


class RuleCreate(BaseModel):
    pattern: str
    category_id: int
    priority: int = 0

    @field_validator("pattern")
    @classmethod
    def validate_pattern(cls, v: str) -> str:
        try:
            re.compile(v, re.IGNORECASE)
        except re.error as e:
            raise ValueError(f"Invalid regex: {e}")
        return v


class RuleOut(BaseModel):
    id: int
    pattern: str
    category_id: int
    category_name: str | None = None
    priority: int

    model_config = {"from_attributes": True}


class ApplyRulesResponse(BaseModel):
    categorized: int


@router.get("", response_model=list[RuleOut])
async def list_rules(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CategoryRule)
        .options(joinedload(CategoryRule.category))
        .order_by(CategoryRule.priority.desc(), CategoryRule.id)
    )
    rules = result.scalars().all()
    return [
        RuleOut(
            id=r.id,
            pattern=r.pattern,
            category_id=r.category_id,
            category_name=r.category.name if r.category else None,
            priority=r.priority,
        )
        for r in rules
    ]


@router.post("", response_model=RuleOut, status_code=201)
async def create_rule(data: RuleCreate, db: AsyncSession = Depends(get_db)):
    rule = CategoryRule(
        pattern=data.pattern,
        category_id=data.category_id,
        priority=data.priority,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule, ["category"])
    return RuleOut(
        id=rule.id,
        pattern=rule.pattern,
        category_id=rule.category_id,
        category_name=rule.category.name if rule.category else None,
        priority=rule.priority,
    )


@router.put("/{rule_id}", response_model=RuleOut)
async def update_rule(rule_id: int, data: RuleCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CategoryRule).options(joinedload(CategoryRule.category)).where(CategoryRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Rule not found")

    rule.pattern = data.pattern
    rule.category_id = data.category_id
    rule.priority = data.priority
    await db.commit()
    await db.refresh(rule, ["category"])
    return RuleOut(
        id=rule.id,
        pattern=rule.pattern,
        category_id=rule.category_id,
        category_name=rule.category.name if rule.category else None,
        priority=rule.priority,
    )


@router.delete("/{rule_id}", status_code=204)
async def delete_rule(rule_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CategoryRule).where(CategoryRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Rule not found")
    await db.delete(rule)
    await db.commit()


@router.post("/apply", response_model=ApplyRulesResponse)
async def apply_rules(db: AsyncSession = Depends(get_db)):
    """Apply all rules to uncategorized transactions (or those categorized by rules)."""
    # Load rules ordered by priority desc
    rules_result = await db.execute(
        select(CategoryRule).order_by(CategoryRule.priority.desc(), CategoryRule.id)
    )
    rules = rules_result.scalars().all()
    if not rules:
        return ApplyRulesResponse(categorized=0)

    # Compile patterns
    compiled = [(re.compile(r.pattern, re.IGNORECASE), r.category_id) for r in rules]

    # Get uncategorized transactions + previously rule-categorized ones
    txn_result = await db.execute(
        select(Transaction).where(
            (Transaction.category_id.is_(None)) | (Transaction.category_source == "rule")
        )
    )
    txns = txn_result.scalars().all()

    categorized = 0
    for txn in txns:
        for regex, cat_id in compiled:
            if regex.search(txn.description):
                if txn.category_id != cat_id or txn.category_source != "rule":
                    txn.category_id = cat_id
                    txn.category_source = "rule"
                    txn.category_confidence = 1.0
                    categorized += 1
                break

    await db.commit()
    return ApplyRulesResponse(categorized=categorized)
