"""Run from backend/: uv run python -m unittest discover tests"""
import unittest

import armor
from armor import ArmorFile
from tests.test_install_order import opt, part

GAMMA_BODY = "natives/stm/art/model/character/ch03/032/300/2/ch03_032_3002"
MALE_GAMMA_BODY = "natives/stm/art/model/character/ch02/032/300/2/ch02_032_3002"


class ClassifyTest(unittest.TestCase):
    def test_model_files(self):
        self.assertEqual(armor.classify(f"{GAMMA_BODY}.mesh.241111606"),
                         ArmorFile("032", "300", "body", "female", "mesh"))
        self.assertEqual(armor.classify(f"{MALE_GAMMA_BODY}.chain2.14").role, "physics")
        self.assertEqual(armor.classify(
            "natives/stm/art/model/character/ch02/059/011/3/hair/ch02_059_0113__m_hairadjustparam.user.3"),
            ArmorFile("059", "011", "helm", "male", "other"))

    def test_prefabs(self):
        self.assertEqual(armor.classify(
            "natives/stm/gamedesign/equip/_prefab/armor/female/032/301/waist/ch03_032_3015.pfb.18"),
            ArmorFile("032", "301", "waist", "female", "other"))
        # A whole variant's file has no part
        self.assertIsNone(armor.classify(
            "natives/stm/gamedesign/equip/_prefab/armor/female/032/001/032_001_avp.user.3").part)

    def test_trailing_slashes(self):
        # Some installed.ini entries end in "////"
        self.assertEqual(armor.classify(
            "natives/stm/art/model/character/ch03/100/001/4/ch03_100_0014.chain2.14////").part, "leg")

    def test_not_armor(self):
        self.assertIsNone(armor.classify("natives/stm/art/model/character/minou/chatnoir/x.mesh.241111606"))
        self.assertIsNone(armor.classify("re_chunk_000.pak.sub_000.pak.patch_037.pak"))


class BuildTest(unittest.TestCase):
    def test_later_option_owns_shared_files(self):
        body = opt(0, "Body-04", part(GAMMA_BODY) + [f"{MALE_GAMMA_BODY}.chain2.14"])
        addon = opt(1, "Body-addon-02", [f"{GAMMA_BODY}.mdf2.45"])
        physics = opt(2, "Physics-heavy", [f"{MALE_GAMMA_BODY}.chain2.14"], family="other")
        palico = opt(3, "Palico", ["natives/stm/art/model/character/minou/x.mesh.1"])
        result = armor.build([body, addon, physics, palico], {"032/30": "Arkveld γ"})

        [model] = result["models"]
        self.assertEqual(model["model"], "032")
        self.assertIn("锁刃龙γ", [s["zh"] for s in model["series"]])
        [variant] = model["variants"]
        self.assertEqual((variant["variety"], variant["design"], variant["label"]),
                         ("30", "male", "Arkveld γ"))
        entries = {e["section"]: e for e in variant["parts"]["body"]}
        self.assertEqual(entries["Body-04"]["bodies"], ["female", "male"])
        self.assertEqual((entries["Body-04"]["files"], entries["Body-04"]["owned_files"]), (5, 3))
        self.assertEqual(entries["Body-addon-02"]["roles"], ["material"])
        self.assertEqual(entries["Physics-heavy"]["owned_files"], 1)
        self.assertEqual([(o["section"], o["category"]) for o in result["others"]],
                         [("Palico", "palico")])


if __name__ == "__main__":
    unittest.main()
