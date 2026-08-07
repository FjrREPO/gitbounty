package domain

import "testing"

func TestStatusFromCode(t *testing.T) {
	cases := map[uint8]Status{
		0: StatusNone,
		1: StatusOpen,
		2: StatusPaid,
		3: StatusReclaimed,
		9: StatusNone,
	}
	for code, want := range cases {
		if got := StatusFromCode(code); got != want {
			t.Errorf("StatusFromCode(%d) = %s, want %s", code, got, want)
		}
	}
}
