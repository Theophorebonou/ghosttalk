'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function CreatePollModal({ onClose, onCreatePoll }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isQuiz, setIsQuiz] = useState(false)
  const [allowMultiple, setAllowMultiple] = useState(false)
  const [correctOption, setCorrectOption] = useState(null)

  function addOption() {
    if (options.length < 10) {
      setOptions([...options, ''])
    }
  }

  function removeOption(index) {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index))
    }
  }

  function updateOption(index, value) {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  function handleSubmit(e) {
    e.preventDefault()
    
    const validOptions = options.filter((opt) => opt.trim().length > 0)
    if (validOptions.length < 2) {
      alert('Ajoutez au moins 2 options')
      return
    }

    onCreatePoll({
      question: question.trim(),
      options: validOptions,
      config: {
        isAnonymous,
        isQuiz,
        allowMultipleChoice: allowMultiple,
        correctOptionId: isQuiz ? correctOption : null,
      },
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold text-text">Créer un sondage</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-text">
              Question
            </label>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Posez votre question..."
              maxLength={300}
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-text">
              Options
            </label>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  {isQuiz && (
                    <input
                      type="radio"
                      name="correct"
                      checked={correctOption === index}
                      onChange={() => setCorrectOption(index)}
                      className="mt-2 h-4 w-4"
                    />
                  )}
                  <Input
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    maxLength={100}
                    required
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="px-2 text-text-muted hover:text-red-400"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 10 && (
              <button
                type="button"
                onClick={addOption}
                className="mt-2 text-sm text-primary hover:text-primary-hover"
              >
                + Ajouter une option
              </button>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm text-text">Votes anonymes</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isQuiz}
                onChange={(e) => setIsQuiz(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm text-text">Mode Quiz</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allowMultiple}
                onChange={(e) => setAllowMultiple(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm text-text">Choix multiples</span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button type="submit" className="flex-1">
              Créer
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
