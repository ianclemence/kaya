package kaya

import (
	"testing"
)

func TestIdentityMintedOnce(t *testing.T) {
	ws := t.TempDir()
	s, err := Open(ws, "", "Kaya", "Ian")
	if err != nil {
		t.Fatal(err)
	}
	g := s.KayaEntity()
	if g.ID == "" || g.Name != "Kaya" {
		t.Fatalf("bad entity: %+v", g)
	}
	o := s.OwnerEntity()
	if o.ID == "" || o.DisplayName != "Ian" || g.OwnerID != o.ID {
		t.Fatalf("bad owner link: %+v %+v", g, o)
	}
	// Reopen adopts the same identity (restart-safe, never reminted).
	s2, err := Open(ws, "", "Other", "Other")
	if err != nil {
		t.Fatal(err)
	}
	if s2.KayaEntity().ID != g.ID {
		t.Fatal("kaya_id must survive restart")
	}
	if s2.OwnerEntity().ID != o.ID {
		t.Fatal("owner must survive restart")
	}
}

func TestAdoptsProvidedID(t *testing.T) {
	s, err := Open(t.TempDir(), "kaya-abc", "G", "O")
	if err != nil {
		t.Fatal(err)
	}
	if s.KayaEntity().ID != "kaya-abc" {
		t.Fatal("must adopt kayastate identity id")
	}
}

func TestRenameAndStatus(t *testing.T) {
	s, _ := Open(t.TempDir(), "", "Kaya", "Ian")
	if err := s.Rename("  "); err == nil {
		t.Fatal("blank rename must fail")
	}
	if err := s.Rename("Maus"); err != nil {
		t.Fatal(err)
	}
	if s.KayaEntity().Name != "Maus" {
		t.Fatal("rename must persist")
	}
	if err := s.SetStatus(StatusReady); err != nil {
		t.Fatal(err)
	}
	if s.KayaEntity().Status != StatusReady {
		t.Fatal("status must persist")
	}
}

func TestTimezoneValidation(t *testing.T) {
	s, _ := Open(t.TempDir(), "", "G", "O")
	if err := s.SetTimezone("Not/AZone"); err == nil {
		t.Fatal("invalid timezone must fail")
	}
	if err := s.SetTimezone("Asia/Bangkok"); err != nil {
		t.Fatal(err)
	}
	if s.KayaEntity().Timezone != "Asia/Bangkok" {
		t.Fatal("timezone must persist")
	}
}

func TestPrimaryAgentInvariant(t *testing.T) {
	s, _ := Open(t.TempDir(), "", "G", "O")
	p := s.PrimaryAgent()
	if !p.IsPrimary || p.Kind != "main" || p.KayaID != s.KayaEntity().ID {
		t.Fatalf("bad primary: %+v", p)
	}
	// Second primary rejected; non-primary extension allowed.
	if err := s.RegisterAgent(Agent{ID: "a2", Kind: "main", IsPrimary: true}); err == nil {
		t.Fatal("second primary must be rejected")
	}
	if err := s.RegisterAgent(Agent{ID: "work", Kind: "work", DisplayName: "Work"}); err != nil {
		t.Fatalf("future agent must register: %v", err)
	}
	if len(s.Agents()) != 2 {
		t.Fatal("must list both agents")
	}
	if err := s.RegisterAgent(Agent{ID: "work", Kind: "work"}); err == nil {
		t.Fatal("duplicate agent must be rejected")
	}
}

func TestConversationsBelongToKaya(t *testing.T) {
	// Entity identity is independent of any session: two stores on
	// different workspaces are different Kayas; sessions never mint
	// identity. (Conversation↔Kaya linkage is asserted by the
	// caller's session key carrying the kaya id; here we assert the
	// entity side of that contract.)
	a, _ := Open(t.TempDir(), "", "G", "O")
	b, _ := Open(t.TempDir(), "", "G", "O")
	if a.KayaEntity().ID == b.KayaEntity().ID {
		t.Fatal("distinct workspaces must be distinct Kayas")
	}
}
