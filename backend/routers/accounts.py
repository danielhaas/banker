from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import Account, Bank
from backend.schemas.account import AccountCreate, AccountOut, BankOut

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountOut])
async def list_accounts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Account))
    return result.scalars().all()


@router.post("", response_model=AccountOut, status_code=201)
async def create_account(data: AccountCreate, db: AsyncSession = Depends(get_db)):
    account = Account(**data.model_dump())
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.get("/banks", response_model=list[BankOut])
async def list_banks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Bank))
    return result.scalars().all()
