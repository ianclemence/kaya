package main

import (
	"net/http"

	"github.com/kayahq/kaya/pkg/agent"
)

// registerProactiveRoutes exposes the owner-facing view of Kaya's quiet work.
//
// Kaya reaches out on its own only when something is genuinely useful, and
// the policy (PROACTIVE_PREFERENCES.md) bounds how often. That machinery is
// invisible by default, which makes Kaya look idle when it is watching. This
// endpoint makes it legible: quiet-hours state, today's check-in budget, and
// anything waiting to be delivered.
//
// It is read-only. It changes no policy, delivers nothing, and grants nothing.
func registerProactiveRoutes(mux *http.ServeMux, al *agent.AgentLoop) {
	mux.HandleFunc("/v1/proactive", authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			jsonError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed")
			return
		}
		if al == nil {
			jsonError(w, http.StatusServiceUnavailable, "unavailable", "proactive status is unavailable right now")
			return
		}
		status := al.ProactiveStatus()
		jsonResponse(w, http.StatusOK, map[string]interface{}{
			"ok":        true,
			"proactive": status,
		})
	}))
}
