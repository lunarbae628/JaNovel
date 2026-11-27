package com.janovel.domain.writing.dao;

import com.janovel.domain.writing.entity.SnapshotParent;
import com.janovel.domain.writing.entity.SnapshotParentId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SnapshotParentRepository extends JpaRepository<SnapshotParent, SnapshotParentId> {

    List<SnapshotParent> findAllByQuestionIdOrderByIdParentSnapshotId(long questionId);

    List<SnapshotParent> findAllByIdChildSnapshotIdOrderByIdParentSnapshotId(long childSnapshotId);

    boolean existsByIdParentSnapshotId(long parentSnapshotId);
}
