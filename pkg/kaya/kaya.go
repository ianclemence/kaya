// Package kaya is the canonical Kaya entity: the persistent AI that
// owns conversations, contexts, memory, capabilities, permissions,
// routines, and activity.
//
// Borrowed pattern (OpenMausBot): agents-as-contacts — each agent is an
// entity with identity, model, instructions, memory scope, tools,
// permissions, and state, and the UI talks to the entity, not to a raw
// chat endpoint. Kaya keeps ONE primary entity in V1 (no multi-agent
// orchestration); the Agent domain model is extensible so future
// specialized agents (Work, Research, Home, Travel) attach without a
// rewrite.
//
// A conversation is one interface into Kaya — never the system of
// record. Kaya state exists independently of any chat session.
package kaya

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Status is the lifecycle state of the Kaya entity.
type Status string

const (
	StatusReady      Status = "ready"
	StatusSetup      Status = "setup"
	StatusDegraded   Status = "degraded"
	StatusRecovering Status = "recovering"
)

// Kaya is the persistent entity. Identity fields are canonical here;
// kayastate.Identity remains the on-disk root — this package reads it
// and adds the product layer (status, timezone, locale, updated_at)
// without duplicating the kaya_id across random config files.
type Kaya struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	OwnerID   string    `json:"owner_id"`
	Status    Status    `json:"status"`
	Timezone  string    `json:"timezone"`
	Locale    string    `json:"locale"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Owner is the canonical owner identity. V1 has exactly one owner.
type Owner struct {
	ID          string            `json:"id"`
	DisplayName string            `json:"display_name"`
	Timezone    string            `json:"timezone"`
	Locale      string            `json:"locale"`
	Preferences map[string]string `json:"preferences,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// Agent is the extensible agent domain model. V1 instantiates exactly
// one primary agent (Kind="main", IsPrimary=true). Future specialized
// agents reuse every field; the permission broker and event stream
// already key on AgentID.
type Agent struct {
	ID           string            `json:"id"`
	KayaID      string            `json:"kaya_id"`
	Kind         string            `json:"kind"` // "main" in V1; e.g. "work" later
	DisplayName  string            `json:"display_name"`
	Model        string            `json:"model,omitempty"`
	Instructions string            `json:"instructions,omitempty"`
	MemoryScope  string            `json:"memory_scope,omitempty"`
	Tools        []string          `json:"tools,omitempty"`
	Permissions  map[string]string `json:"permissions,omitempty"`
	State        map[string]string `json:"state,omitempty"`
	IsPrimary    bool              `json:"is_primary"`
	CreatedAt    time.Time         `json:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at"`
}

const (
	entityFile = "state/kaya-entity.json"
	ownerFile  = "state/kaya-owner.json"
	agentsFile = "state/kaya-agents.json"
)

// Store is the canonical file-backed entity store. Writes are atomic;
// the kaya_id is minted once and preserved across restarts.
type Store struct {
	mu        sync.RWMutex
	workspace string
	kaya     *Kaya
	owner     *Owner
	agents    map[string]*Agent
}

func loadJSON(path string, v interface{}) bool {
	data, err := os.ReadFile(path)
	if err != nil {
		return false
	}
	return json.Unmarshal(data, v) == nil
}

func storeJSON(path string, v interface{}) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// Open loads (or initializes) the entity store for a workspace. The
// kaya_id is adopted from kayastate identity when present so there is
// exactly one "which Kaya is this" answer; otherwise minted once here.
func Open(workspace, kayaID, kayaName, ownerName string) (*Store, error) {
	s := &Store{workspace: workspace, agents: map[string]*Agent{}}
	var g Kaya
	if loadJSON(filepath.Join(workspace, entityFile), &g) && g.ID != "" {
		s.kaya = &g
	} else {
		id := strings.TrimSpace(kayaID)
		if id == "" {
			id = "kaya-" + uuid.NewString()[:8]
		}
		now := time.Now()
		s.kaya = &Kaya{ID: id, Name: kayaName, Status: StatusSetup, CreatedAt: now, UpdatedAt: now}
		if err := s.saveKaya(); err != nil {
			return nil, err
		}
	}
	if s.kaya.Name == "" && kayaName != "" {
		s.kaya.Name = kayaName
		s.kaya.UpdatedAt = time.Now()
		_ = s.saveKaya()
	}
	var o Owner
	if loadJSON(filepath.Join(workspace, ownerFile), &o) && o.ID != "" {
		s.owner = &o
	} else {
		now := time.Now()
		s.owner = &Owner{ID: "owner-" + uuid.NewString()[:8], DisplayName: ownerName, CreatedAt: now, UpdatedAt: now}
		if err := s.saveOwner(); err != nil {
			return nil, err
		}
	}
	if s.owner.DisplayName == "" && ownerName != "" {
		s.owner.DisplayName = ownerName
		s.owner.UpdatedAt = time.Now()
		_ = s.saveOwner()
	}
	s.kaya.OwnerID = s.owner.ID
	var agents []*Agent
	if loadJSON(filepath.Join(workspace, agentsFile), &agents) {
		for _, a := range agents {
			if a != nil && a.ID != "" {
				s.agents[a.ID] = a
			}
		}
	}
	if len(s.agents) == 0 {
		now := time.Now()
		primary := &Agent{ID: "agent-main", KayaID: s.kaya.ID, Kind: "main",
			DisplayName: "Kaya", IsPrimary: true, CreatedAt: now, UpdatedAt: now}
		s.agents[primary.ID] = primary
		if err := s.saveAgents(); err != nil {
			return nil, err
		}
	}
	return s, nil
}

func (s *Store) saveKaya() error { return storeJSON(filepath.Join(s.workspace, entityFile), s.kaya) }
func (s *Store) saveOwner() error { return storeJSON(filepath.Join(s.workspace, ownerFile), s.owner) }
func (s *Store) saveAgents() error {
	list := make([]*Agent, 0, len(s.agents))
	for _, a := range s.agents {
		list = append(list, a)
	}
	return storeJSON(filepath.Join(s.workspace, agentsFile), list)
}

// KayaEntity returns the canonical Kaya (a copy).
func (s *Store) KayaEntity() Kaya {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return *s.kaya
}

// OwnerEntity returns the canonical owner (a copy).
func (s *Store) OwnerEntity() Owner {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return *s.owner
}

// Rename updates the Kaya name (user-visible identity change).
func (s *Store) Rename(name string) error {
	if strings.TrimSpace(name) == "" {
		return errors.New("name required")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.kaya.Name = strings.TrimSpace(name)
	s.kaya.UpdatedAt = time.Now()
	return s.saveKaya()
}

// SetStatus updates lifecycle status.
func (s *Store) SetStatus(st Status) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.kaya.Status = st
	s.kaya.UpdatedAt = time.Now()
	return s.saveKaya()
}

// SetTimezone validates (IANA) and stores the Kaya timezone.
func (s *Store) SetTimezone(tz string) error {
	if _, err := time.LoadLocation(tz); err != nil {
		return errors.New("unknown timezone")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.kaya.Timezone = tz
	s.kaya.UpdatedAt = time.Now()
	return s.saveKaya()
}

// SetOwnerDetails updates display name/timezone/locale.
func (s *Store) SetOwnerDetails(name, tz, locale string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if name != "" {
		s.owner.DisplayName = name
	}
	if tz != "" {
		if _, err := time.LoadLocation(tz); err != nil {
			return errors.New("unknown timezone")
		}
		s.owner.Timezone = tz
	}
	if locale != "" {
		s.owner.Locale = locale
	}
	s.owner.UpdatedAt = time.Now()
	return s.saveOwner()
}

// PrimaryAgent returns the V1 primary agent.
func (s *Store) PrimaryAgent() Agent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, a := range s.agents {
		if a.IsPrimary {
			return *a
		}
	}
	// Invariant: Open always ensures one primary; defensive fallback.
	return Agent{ID: "agent-main", KayaID: s.kaya.ID, Kind: "main", IsPrimary: true}
}

// RegisterAgent adds a future specialized agent. V1 callers should not
// need this (one primary exists); it exists so extension needs no
// rewrite. Registering a second primary is rejected.
func (s *Store) RegisterAgent(a Agent) error {
	if strings.TrimSpace(a.ID) == "" || strings.TrimSpace(a.Kind) == "" {
		return errors.New("agent id and kind required")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.agents[a.ID]; exists {
		return errors.New("agent already registered")
	}
	if a.IsPrimary {
		for _, e := range s.agents {
			if e.IsPrimary {
				return errors.New("a primary agent already exists")
			}
		}
	}
	now := time.Now()
	a.KayaID = s.kaya.ID
	a.CreatedAt = now
	a.UpdatedAt = now
	cp := a
	s.agents[a.ID] = &cp
	return s.saveAgents()
}

// Agents lists all registered agents.
func (s *Store) Agents() []Agent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Agent, 0, len(s.agents))
	for _, a := range s.agents {
		out = append(out, *a)
	}
	return out
}
