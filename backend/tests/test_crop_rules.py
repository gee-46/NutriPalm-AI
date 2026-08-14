import pytest

from app.exceptions import UnsupportedCrop
from app.services import crop_rules


def test_list_supported_crops_nonempty():
    crops = crop_rules.list_supported_crops()
    assert "oil_palm" in crops
    assert "rice" in crops


def test_get_crop_requirement_known_crop():
    req = crop_rules.get_crop_requirement("oil_palm")
    assert req.crop == "oil_palm"
    assert req.n_target_kg_ha > 0


def test_get_crop_requirement_is_case_and_space_insensitive():
    req = crop_rules.get_crop_requirement("Oil Palm")
    assert req.crop == "oil_palm"


def test_get_crop_requirement_unknown_crop_raises():
    with pytest.raises(UnsupportedCrop):
        crop_rules.get_crop_requirement("dragonfruit")
