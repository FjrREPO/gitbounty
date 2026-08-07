// Package server wires routes and middleware into an http.Server.
package server

import (
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/FjrREPO/gitbounty/apps/api/internal/handler"
)

// New builds the API server.
func New(port int, h *handler.Handler, log *slog.Logger) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", h.Health)
	mux.HandleFunc("GET /api/v1/bounties", h.ListBounties)
	mux.HandleFunc("GET /api/v1/bounties/{id}", h.GetBounty)
	mux.HandleFunc("GET /api/v1/providers", h.ListProviders)
	mux.HandleFunc("GET /api/v1/github", h.GitHubMeta)

	return &http.Server{
		Addr:              fmt.Sprintf(":%d", port),
		Handler:           chain(mux, recovered(log), logged(log), cors),
		ReadHeaderTimeout: 5 * time.Second,
	}
}

type middleware func(http.Handler) http.Handler

func chain(h http.Handler, middlewares ...middleware) http.Handler {
	for i := len(middlewares) - 1; i >= 0; i-- {
		h = middlewares[i](h)
	}
	return h
}

func logged(log *slog.Logger) middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			next.ServeHTTP(w, r)
			log.Info("request",
				"method", r.Method,
				"path", r.URL.Path,
				"duration", time.Since(start).String(),
			)
		})
	}
}

func recovered(log *slog.Logger) middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
					log.Error("panic", "error", err, "path", r.URL.Path)
					http.Error(w, `{"error":"internal server error"}`, http.StatusInternalServerError)
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
