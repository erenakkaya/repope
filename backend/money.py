from decimal import Decimal, ROUND_HALF_UP


def to_cents(value) -> int:
    return int((Decimal(str(value)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def fmt(cents: int) -> str:
    return f"{Decimal(cents) / 100:.2f}"
