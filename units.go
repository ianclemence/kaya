// Package kayaroot carries the systemd unit templates inside the binary.
//
// An update has to refresh the units from the templates of the release being
// installed, not from a git checkout that may be older than that release (or
// absent), and not from the copy of `kaya` that happens to be running the
// update. The new binary prints its own templates (`kaya __unit <name>`).
package kayaroot

import "embed"

//go:embed kaya.service.template kaya-web.service.template
var unitFS embed.FS

// UnitTemplate returns the template for "kaya" or "kaya-web".
func UnitTemplate(name string) (string, bool) {
	switch name {
	case "kaya", "kaya-web":
		b, err := unitFS.ReadFile(name + ".service.template")
		return string(b), err == nil
	}
	return "", false
}
