require "timeout"

module DatabaseLockAssertions
  # Hold the shared row on one connection while the mutation runs on another.
  # Observe the database lock instead of relying on thread scheduling or sleeps.
  def assert_waiting_mutation(record, mutation)
    worker = nil
    pid = Queue.new
    record.with_lock do
      worker = Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do |connection|
          pid << connection.select_value("SELECT pg_backend_pid()")
          mutation.call
        end
      end
      worker.report_on_exception = false
      backend_pid = Timeout.timeout(5) { pid.pop }.to_i
      waiting = Timeout.timeout(5) do
        loop do
          blocked = ActiveRecord::Base.uncached do
            ActiveRecord::Base.connection.select_value(
              "SELECT cardinality(pg_blocking_pids(#{backend_pid})) > 0"
            )
          end
          break true if blocked
          break false unless worker.alive?
          sleep 0.01
        end
      end
      assert waiting, "Mutation must wait for the shared row lock before checking mutation validity"
      yield
    end
  ensure
    if worker
      unless worker.join(5)
        worker.kill.join
        flunk "Mutation did not finish after lock release"
      end
      worker.value
    end
  end
end
