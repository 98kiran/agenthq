import unittest
from unittest.mock import patch

from dispatcher import log

import dispatcher


class DispatcherTests(unittest.TestCase):
    def setUp(self):
        dispatcher._dispatched_task_ids.clear()

    def test_claim_task_if_todo_claims_only_todo_rows(self):
        claimed_row = {"id": "task-1", "status": "in-progress"}
        with patch.object(dispatcher, "supabase_patch", return_value=[claimed_row]) as mock_patch:
            result = dispatcher.claim_task_if_todo("task-1")

        self.assertEqual(result, claimed_row)
        mock_patch.assert_called_once()
        args = mock_patch.call_args.args
        self.assertEqual(args[0], "tasks")
        self.assertEqual(args[1], {"id": "eq.task-1", "status": "eq.todo"})
        self.assertEqual(args[2]["status"], "in-progress")
        self.assertIn("updated_at", args[2])

        with patch.object(dispatcher, "supabase_patch", return_value=[]):
            self.assertIsNone(dispatcher.claim_task_if_todo("task-2"))

    def test_prune_dispatched_cache_expires_old_entries_only(self):
        with patch.object(dispatcher.time, "time", return_value=1000):
            dispatcher._dispatched_task_ids.update({
                "fresh": 950,
                "stale": 699,
                "edge": 700,
            })
            dispatcher._prune_dispatched_cache()

        self.assertEqual(dispatcher._dispatched_task_ids, {"fresh": 950, "edge": 700})

    def test_dispatched_task_ids_prevents_double_dispatch(self):
        task = {
            "id": "task-1",
            "agent": "pam",
            "project": "AgentHQ",
            "phase": "qa",
            "description": "Verify behavior",
        }
        with patch.object(dispatcher, "claim_task_if_todo", return_value=task) as claim_mock, \
             patch.object(dispatcher, "send_to_agent", return_value=True) as send_mock, \
             patch.object(dispatcher, "log_timeline"):
            first = dispatcher.dispatch_tasks_once([task], [])
            second = dispatcher.dispatch_tasks_once([task], [])

        self.assertEqual(first["dispatched"], ["task-1"])
        self.assertEqual(second["dispatched"], [])
        self.assertIn(("task-1", "already-dispatched"), second["skipped"])
        claim_mock.assert_called_once_with("task-1")
        send_mock.assert_called_once()

    def test_one_task_per_agent_skips_when_agent_already_has_active_task(self):
        todo_task = {
            "id": "task-3",
            "agent": "samdev",
            "project": "AgentHQ",
            "phase": "cleanup",
            "description": "Do the cleanup",
        }
        in_progress_tasks = [{
            "id": "task-active",
            "agent": "samdev",
            "project": "DifferentProject",
            "phase": "other-phase",
        }]

        with patch.object(dispatcher, "claim_task_if_todo") as claim_mock, \
             patch.object(log, "info") as info_mock:
            summary = dispatcher.dispatch_tasks_once([todo_task], in_progress_tasks)

        self.assertEqual(summary["claimed"], [])
        self.assertEqual(summary["dispatched"], [])
        self.assertIn(("task-3", "agent-has-active-task"), summary["skipped"])
        claim_mock.assert_not_called()
        info_mock.assert_any_call("Agent samdev already has an active task, skipping")

    def test_build_task_message_formats_expected_fields(self):
        task = {
            "id": "123",
            "project": "AgentHQ",
            "phase": "dispatcher",
            "priority": "high",
            "description": "Ship the patch",
        }
        msg = dispatcher.build_task_message(task)
        self.assertIn("**New Task Assigned** 🟠 Priority: HIGH", msg)
        self.assertIn("**Project:** AgentHQ", msg)
        self.assertIn("**Phase:** dispatcher", msg)
        self.assertIn("**Task ID:** 123", msg)
        self.assertIn("Ship the patch", msg)
        self.assertIn("When complete:", msg)

    def test_notify_failure_reverts_task_to_todo_and_clears_dedupe(self):
        task = {
            "id": "task-2",
            "agent": "pam",
            "project": "AgentHQ",
            "phase": "notify",
            "description": "Dispatch and fail",
            "retries": 2,
        }
        with patch.object(dispatcher, "claim_task_if_todo", return_value=task), \
             patch.object(dispatcher, "send_to_agent", return_value=False), \
             patch.object(dispatcher, "supabase_patch", return_value=[{"id": "task-2"}]) as patch_mock, \
             patch.object(dispatcher, "log_timeline") as timeline_mock:
            summary = dispatcher.dispatch_tasks_once([task], [])

        self.assertEqual(summary["reverted"], ["task-2"])
        self.assertNotIn("task-2", dispatcher._dispatched_task_ids)
        timeline_mock.assert_not_called()
        patch_mock.assert_called_once()
        args = patch_mock.call_args.args
        self.assertEqual(args[0], "tasks")
        self.assertEqual(args[1], {"id": "eq.task-2", "status": "eq.in-progress"})
        self.assertEqual(args[2]["status"], "todo")
        self.assertEqual(args[2]["retries"], 3)
        self.assertIn("updated_at", args[2])

    def test_empty_task_lists_are_handled_gracefully(self):
        summary = dispatcher.dispatch_tasks_once([], [])
        self.assertEqual(summary, {"claimed": [], "dispatched": [], "reverted": [], "skipped": []})


if __name__ == "__main__":
    unittest.main(verbosity=2)
