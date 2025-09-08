package commands

type LLAction string

const (
	LLActionSet  LLAction = "set"
	LLActionTilt LLAction = "tilt"
	LLActionSlat LLAction = "slat"
)

type LLCommand struct {
	Action   LLAction
	Position int
}
