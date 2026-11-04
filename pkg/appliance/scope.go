package appliance

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// InstallScope describes where Kaya is installed and which privilege the
// update needs. Scout and Pi both install user-locally and use per-user
// services, so the default Kaya path should need no root either; the
// system-wide appliance layout is opt-in and only then requires sudo.
type InstallScope int

const (
	// ScopeUnknown means neither layout is detected.
	ScopeUnknown InstallScope = iota
	// ScopeUser: binary under ~/.local/bin, per-user systemd units
	// (`systemctl --user`). No root required.
	ScopeUser
	// ScopeSystem: binary under /usr/local/bin, system units. Root required
	// only to replace the binary and restart the system services.
	ScopeSystem
)

func (s InstallScope) String() string {
	switch s {
	case ScopeUser:
		return "user"
	case ScopeSystem:
		return "system"
	default:
		return "unknown"
	}
}

// ScopePaths is the resolved install layout for an update.
type ScopePaths struct {
	Scope InstallScope
	// BinDir is where the kaya binary lives and where an update writes it.
	BinDir string
	// UserBinDir / SystemBinDir are candidates considered during detection.
	UserBinDir   string
	SystemBinDir string
	// Home is the invoking user's home.
	Home string
}

func homeDir() string {
	if h := os.Getenv("HOME"); h != "" {
		return h
	}
	h, _ := os.UserHomeDir()
	return h
}

// DetectScope inspects the machine and returns the install layout an update
// must target. The rules live in decideScope: what is actually serving wins,
// then an explicit unit, then which binaries exist. A fresh machine defaults
// to the unprivileged user layout.
func DetectScope() ScopePaths {
	home := homeDir()
	userBin := filepath.Join(home, ".local", "bin")
	sysBin := DefaultBinDir
	// Test/advanced override so detection can be exercised without a real
	// /usr/local/bin install on the machine.
	if v := strings.TrimSpace(os.Getenv("KAYA_SYSTEM_BIN_DIR")); v != "" {
		sysBin = v
	}

	p := ScopePaths{
		UserBinDir:   userBin,
		SystemBinDir: sysBin,
		Home:         home,
	}

	probes := scopeProbes{
		userUnit:     userServiceExists("kaya"),
		userUnitLive: userServiceActive("kaya"),
		userBin:      fileExists(filepath.Join(userBin, "kaya")),
		sysUnit:      systemServiceExists("kaya"),
		sysUnitLive:  systemServiceActive("kaya"),
		sysBin:       fileExists(filepath.Join(sysBin, "kaya")),
	}
	p.Scope = decideScope(probes)
	if p.Scope == ScopeSystem {
		p.BinDir = sysBin
	} else {
		p.BinDir = userBin
	}
	return p
}

// scopeProbes is everything DetectScope learns about the machine, so the
// decision itself is a pure function that tests can drive.
type scopeProbes struct {
	userUnit, userUnitLive bool // per-user kaya.service: present / running
	sysUnit, sysUnitLive   bool // system kaya.service: present / running
	userBin, sysBin        bool // a kaya binary in ~/.local/bin, /usr/local/bin
}

// decideScope picks where an update must land. What is actually SERVING wins:
// a running system service owns the port and runs /usr/local/bin/kaya, so an
// update installed anywhere else never reaches it. A stray ~/.local/bin/kaya
// must not outvote that: the first user-scope update creates it, which made the
// old rule ("a user binary means user scope") self-perpetuating and left the
// real daemon on an old release.
func decideScope(p scopeProbes) InstallScope {
	switch {
	case p.sysUnitLive:
		return ScopeSystem
	case p.userUnitLive:
		return ScopeUser
	case p.userUnit:
		return ScopeUser
	case p.sysUnit || p.sysBin:
		return ScopeSystem
	default:
		// Only a user binary, or nothing installed yet: unprivileged.
		return ScopeUser
	}
}

// BothDaemonsRunning reports the case that needs the owner's attention: a
// system and a per-user kaya service both active, competing for one port.
func BothDaemonsRunning() bool {
	return systemServiceActive("kaya") && userServiceActive("kaya")
}

// NeedsRoot reports whether an update of this layout requires root.
func (p ScopePaths) NeedsRoot() bool { return p.Scope == ScopeSystem }

// UserUnitDir is where the per-user kaya.service unit lives.
func (p ScopePaths) UserUnitDir() string {
	if xdg := os.Getenv("XDG_CONFIG_HOME"); xdg != "" {
		return filepath.Join(xdg, "systemd", "user")
	}
	return filepath.Join(p.Home, ".config", "systemd", "user")
}

// UserUnitPath is the per-user kaya.service path.
func (p ScopePaths) UserUnitPath() string { return filepath.Join(p.UserUnitDir(), "kaya.service") }

// SystemUnitPath is the system kaya.service path.
func (p ScopePaths) SystemUnitPath() string { return "/etc/systemd/system/kaya.service" }

// UserBinaryPath / SystemBinaryPath are the candidate install targets.
func (p ScopePaths) UserBinaryPath() string   { return filepath.Join(p.UserBinDir, "kaya") }
func (p ScopePaths) SystemBinaryPath() string { return filepath.Join(p.SystemBinDir, "kaya") }

// userServiceExists reports whether a per-user systemd unit is known.
func userServiceExists(name string) bool {
	if !hasSystemctl() {
		return false
	}
	return exec.Command("systemctl", "--user", "cat", name).Run() == nil
}

// systemServiceExists reports whether a system systemd unit is known.
func systemServiceExists(name string) bool {
	if !hasSystemctl() {
		return false
	}
	return exec.Command("systemctl", "cat", name).Run() == nil
}

// systemServiceActive / userServiceActive report a unit that is running now.
func systemServiceActive(name string) bool {
	return hasSystemctl() && exec.Command("systemctl", "is-active", "--quiet", name).Run() == nil
}

func userServiceActive(name string) bool {
	return hasSystemctl() && exec.Command("systemctl", "--user", "is-active", "--quiet", name).Run() == nil
}

func hasSystemctl() bool {
	_, err := exec.LookPath("systemctl")
	return err == nil
}

// KayaDirEnv returns an override directory for the checkout, if set.
func KayaDirEnv() string { return strings.TrimSpace(os.Getenv("KAYA_DIR")) }
