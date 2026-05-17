from .roles import resolve_role, city_multiplier


def compute_gap(role_query: str, city: str) -> dict | None:
    role = resolve_role(role_query)
    if not role:
        return None

    mult            = city_multiplier(city)
    mens_rate       = round(role["national_median"] * mult)
    womens_expected = round(mens_rate * role["gender_ratio"])
    gap_dollars     = mens_rate - womens_expected
    gap_ratio       = round(role["gender_ratio"] * 100)

    return {
        "mens_market_rate": mens_rate,
        "womens_expected":  womens_expected,
        "gap_dollars":      gap_dollars,
        "gap_ratio":        gap_ratio,
        "ratio_label":      f"{gap_ratio}¢ on the dollar",
    }
