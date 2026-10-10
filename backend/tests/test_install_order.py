"""Run from backend/: uv run python -m unittest discover tests"""
import unittest
from dataclasses import replace

import install_order
from install_order import Option

BODY = "natives/stm/art/model/character/ch03/053/001/2/ch03_053_0012"
LEG = "natives/stm/art/model/character/ch03/053/001/4/ch03_053_0014"
MALE_BODY = "natives/stm/art/model/character/ch02/053/000/2/ch02_053_0002"
FEMALE_BODY = "natives/stm/art/model/character/ch03/053/000/2/ch03_053_0002"
HELM_PFB = "natives/stm/gamedesign/equip/_prefab/armor/female/053/000/helm/ch03_053_0003.pfb.18"


def opt(index, name, files, family="4776"):
    return Option(index=index, section=name, mod_id=str(index + 100), short_id="0",
                  mod_name=name, archive=f"{family}.zip", folder=name, family=family,
                  files=set(files))


def part(prefix):
    return [f"{prefix}.mesh.241111606", f"{prefix}.mdf2.45", f"{prefix}.chain2.14", f"{prefix}.clsp.3"]


def unknown(option, f):
    return None


class MustFollowTest(unittest.TestCase):
    def test_addon_follows_its_part(self):
        body = opt(0, "Body-03", part(BODY))
        addon = opt(1, "Body-addon-01-no cape", [f"{BODY}.mdf2.45"])
        self.assertTrue(install_order.must_follow(addon, body))
        self.assertFalse(install_order.must_follow(body, addon))

    def test_male_and_female_folders_count_as_one_part(self):
        # An F-M body ships male physics next to the female mesh
        body = opt(0, "Body-04", [f"{MALE_BODY}.chain2.14"] + part(FEMALE_BODY)[:3])
        physics = opt(1, "Physics-body-heavy", [f"{MALE_BODY}.chain2.14"])
        self.assertTrue(install_order.must_follow(physics, body))

    def test_tie_keeps_user_order(self):
        # Both ship the helm prefab; the helm option's copy is the one meant to win
        basic = opt(0, "basic files", [HELM_PFB, "a.json", "b.json"])
        helm = opt(1, "Helm-01-vanilla", [HELM_PFB] + [f"hair/{i}.user.3" for i in range(30)])
        self.assertFalse(install_order.must_follow(basic, helm))
        self.assertEqual(install_order.find_issues([basic, helm], unknown), [])

    def test_other_mods_keep_user_order(self):
        addon = opt(0, "addon", [f"{BODY}.mdf2.45"], family="a")
        other = opt(1, "other mod body", part(BODY), family="b")
        self.assertFalse(install_order.must_follow(addon, other))
        self.assertTrue(install_order.must_follow(other, addon))


class FindIssuesTest(unittest.TestCase):
    def test_addon_installed_before_its_part(self):
        addon = opt(0, "Body-addon-01-no cape", [f"{BODY}.mdf2.45"])
        body = opt(1, "Body-03", part(BODY))
        [issue] = install_order.find_issues([addon, body], unknown)
        self.assertEqual(issue["kind"], "misordered")
        self.assertIs(issue["option"], addon)
        self.assertEqual(issue["overridden_by"], [body])
        self.assertFalse(issue["verified"])

    def test_part_overlaid_by_later_addon_is_fine(self):
        body = opt(0, "Body-03", part(BODY))
        addon = opt(1, "Body-addon-01-no cape", [f"{BODY}.mdf2.45"])
        self.assertEqual(install_order.find_issues([body, addon], unknown), [])

    def test_identical_content_is_not_lost(self):
        addon = opt(0, "addon", [f"{BODY}.mdf2.45"])
        body = opt(1, "Body-03", part(BODY))
        self.assertEqual(install_order.find_issues([addon, body], lambda o, f: True), [])

    def test_variant_replacing_everything_is_informational(self):
        a = opt(0, "Physics alpha", [f"{BODY}.chain2.14"])
        b = opt(1, "Physics gamma", [f"{BODY}.chain2.14"])
        [issue] = install_order.find_issues([a, b], lambda o, f: False)
        self.assertEqual(issue["kind"], "overridden")
        self.assertTrue(issue["verified"])


class ReinstallOrderTest(unittest.TestCase):
    def test_fix_puts_addons_after_their_parts(self):
        addon = opt(0, "addon", [f"{BODY}.mdf2.45"])
        physics = opt(1, "physics", [f"{BODY}.chain2.14", f"{LEG}.chain2.14"])
        body = opt(2, "body", part(BODY))
        leg = opt(3, "leg", part(LEG))
        order = install_order.reinstall_order([addon, physics], [body, leg], install_order.must_follow)
        self.assertEqual([o.section for o in order], ["addon", "physics"])

    def test_options_on_top_of_an_updated_part_are_reinstalled_after_it(self):
        body = opt(0, "body", part(BODY))
        addon = opt(1, "nsfw addon", [f"{BODY}.mdf2.45"])
        unrelated = opt(2, "leg", part(LEG))
        new_body = replace(body, section="body v2", mod_id="999")
        order = install_order.reinstall_order([new_body], [addon, unrelated])
        self.assertEqual([o.section for o in order], ["body v2", "nsfw addon"])

    def test_update_keeps_the_users_order(self):
        # An addon installed before its part stays under it: no rule is imposed
        addon = opt(0, "addon", [f"{BODY}.mdf2.45"])
        body = opt(1, "body", part(BODY))
        order = install_order.reinstall_order([replace(addon, mod_id="999")], [body])
        self.assertEqual([o.section for o in order], ["addon", "body"])

    def test_closure_follows_chains(self):
        body = opt(0, "body", part(BODY))
        addon = opt(1, "addon", [f"{BODY}.mdf2.45", f"{BODY}.chain2.14"])
        physics = opt(2, "physics", [f"{BODY}.chain2.14"])
        order = install_order.reinstall_order([replace(body, mod_id="999")], [addon, physics])
        self.assertEqual([o.section for o in order], ["body", "addon", "physics"])

    def test_fix_keeps_other_mods_relative_order(self):
        body = opt(0, "body", part(BODY), family="a")
        later = opt(1, "other mod addon", [f"{BODY}.mdf2.45"], family="b")
        order = install_order.reinstall_order([body], [later], install_order.must_follow)
        self.assertEqual([o.section for o in order], ["body", "other mod addon"])


if __name__ == "__main__":
    unittest.main()
