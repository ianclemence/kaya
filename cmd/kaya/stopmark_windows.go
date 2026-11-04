package main

import (
	"os"
	"os/signal"

	"github.com/kayahq/kaya/pkg/hardware"
)

func markCleanStopOnSignal(marker string) {
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt)
	go func() {
		<-c
		hardware.MarkStopped(marker)
		os.Exit(0)
	}()
}
