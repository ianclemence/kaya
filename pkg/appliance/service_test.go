package appliance

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestWebServiceTemplate(t *testing.T) {
	data, err := os.ReadFile("../../kaya-web.service.template")
	if err != nil {
		t.Fatalf("failed to read web console service template: %v", err)
	}
	content := string(data)

	// Verify Type=simple (always-on wizard, not a oneshot)
	if !strings.Contains(content, "Type=simple") {
		t.Error("web console service should be Type=simple")
	}

	// Verify Restart=always (keeps the wizard always available)
	if !strings.Contains(content, "Restart=always") {
		t.Error("web console service should have Restart=always")
	}

	// Verify Before=kaya.service (ensures web console starts before kaya)
	if !strings.Contains(content, "Before=kaya.service") {
		t.Error("web console service should have Before=kaya.service")
	}

	// Verify -force flag is used (wizard stays available after setup)
	if !strings.Contains(content, "-force") {
		t.Error("web console service should use -force flag to stay available after setup")
	}

	// Verify no ConditionPathExists (wizard must run even when setup is complete)
	if strings.Contains(content, "ConditionPathExists=") {
		t.Error("web console service should not have ConditionPathExists")
	}

	// Verify WantedBy=multi-user.target
	if !strings.Contains(content, "WantedBy=multi-user.target") {
		t.Error("web console service should be wanted by multi-user.target")
	}

	// Verify the ExecStart points at the new binary name
	if !strings.Contains(content, "kaya-web") {
		t.Error("web console service ExecStart should reference kaya-web")
	}

	// Verify no legacy alias remains (fully removed)
	if strings.Contains(content, "kaya-firstboot") {
		t.Error("web console service should not reference the legacy kaya-firstboot alias")
	}
}

func TestKayaServiceTemplate(t *testing.T) {
	data, err := os.ReadFile("../../kaya.service.template")
	if err != nil {
		t.Fatalf("failed to read kaya service template: %v", err)
	}
	content := string(data)

	// Verify ConditionPathExists (only starts after setup is complete)
	if !strings.Contains(content, "ConditionPathExists=") {
		t.Error("kaya service should have ConditionPathExists")
	}

	// Verify After includes kaya-web.service (waits for web console)
	if !strings.Contains(content, "kaya-web.service") {
		t.Error("kaya service should depend on kaya-web.service")
	}

	// Verify Restart=always
	if !strings.Contains(content, "Restart=always") {
		t.Error("kaya service should have Restart=always")
	}

	// Verify EnvironmentFile
	if !strings.Contains(content, "EnvironmentFile=") {
		t.Error("kaya service should have EnvironmentFile")
	}

	// Verify WantedBy=multi-user.target
	if !strings.Contains(content, "WantedBy=multi-user.target") {
		t.Error("kaya service should be wanted by multi-user.target")
	}
}

func TestServiceTemplatesHaveUser(t *testing.T) {
	tests := []struct {
		file    string
		hasUser bool
	}{
		{"../../kaya-web.service.template", true},
		{"../../kaya.service.template", true},
	}

	for _, tt := range tests {
		data, err := os.ReadFile(tt.file)
		if err != nil {
			t.Fatalf("failed to read %s: %v", tt.file, err)
		}
		content := string(data)

		if tt.hasUser && !strings.Contains(content, "User=") {
			t.Errorf("%s should have User= directive", filepath.Base(tt.file))
		}
	}
}
