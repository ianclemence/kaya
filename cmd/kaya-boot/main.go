package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

func main() {
	kayaDir := "/var/kaya"
	if dir := os.Getenv("KAYA_DIR"); dir != "" {
		kayaDir = dir
	}

	setupComplete := filepath.Join(kayaDir, ".setup-complete")

	// Check if setup is complete
	if _, err := os.Stat(setupComplete); os.IsNotExist(err) {
		// Setup not complete - start web console (setup wizard + dashboard)
		fmt.Println("Setup not complete. Starting setup wizard...")
		fmt.Println("Open http://<your-pi-ip> on your phone to continue.")
		cmd := exec.Command("systemctl", "start", "kaya-web")
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			fmt.Printf("Failed to start setup wizard: %v\n", err)
			fmt.Println("Try: sudo systemctl start kaya-web")
		}
		return
	}

	// Setup complete - start kaya
	fmt.Println("Starting Kaya...")
	cmd := exec.Command("systemctl", "start", "kaya")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		fmt.Printf("Failed to start Kaya: %v\n", err)
		fmt.Println("Try: sudo systemctl start kaya")
		return
	}
	fmt.Println("Kaya started. Access at http://<your-pi-ip>:8766")
}
